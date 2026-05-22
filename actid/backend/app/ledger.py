import hashlib
import json
from datetime import datetime
from uuid import uuid4
from typing import Optional
from sqlalchemy.orm import Session


GENESIS_HASH = "0" * 64


def _compute_hash(prev_hash: str, timestamp: str, action: str, actor_id: str, metadata: dict) -> str:
    content = f"{prev_hash}|{timestamp}|{action}|{actor_id}|{json.dumps(metadata, sort_keys=True)}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def add_audit_entry(
    db: Session,
    action: str,
    actor_id: str,
    actor_name: str,
    actor_role: str = "cetățean",
    target_document_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> "AuditEntry":  # type: ignore
    from .models.models import AuditEntry

    last = db.query(AuditEntry).order_by(AuditEntry.block_number.desc()).first()
    prev_hash = last.hash if last else GENESIS_HASH
    block_number = (last.block_number + 1) if last else 0

    ts = datetime.utcnow()
    ts_str = ts.isoformat()
    meta = metadata or {}

    hash_val = _compute_hash(prev_hash, ts_str, action, actor_id or "sistem", meta)

    entry = AuditEntry(
        id=str(uuid4()),
        timestamp=ts,
        action=action,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        target_document_id=target_document_id,
        target_user_id=target_user_id,
        metadata_json=json.dumps(meta),
        prev_hash=prev_hash,
        hash=hash_val,
        block_number=block_number,
    )
    db.add(entry)
    db.flush()
    return entry


def verify_chain(db: Session) -> dict:
    from .models.models import AuditEntry

    entries = db.query(AuditEntry).order_by(AuditEntry.block_number.asc()).all()
    if not entries:
        return {"valid": True, "entries_checked": 0, "message": "Ledger gol — fără intrări"}

    errors = []
    for i, entry in enumerate(entries):
        expected_prev = entries[i - 1].hash if i > 0 else GENESIS_HASH
        if entry.prev_hash != expected_prev:
            errors.append(f"Block {entry.block_number}: prev_hash corupt")
            continue

        meta = {}
        if entry.metadata_json:
            try:
                meta = json.loads(entry.metadata_json)
            except Exception:
                pass

        expected_hash = _compute_hash(
            entry.prev_hash,
            entry.timestamp.isoformat(),
            entry.action,
            entry.actor_id or "sistem",
            meta,
        )
        if entry.hash != expected_hash:
            errors.append(f"Block {entry.block_number}: hash invalid")

    return {
        "valid": len(errors) == 0,
        "entries_checked": len(entries),
        "errors": errors,
        "message": "Lanț valid ✓" if not errors else f"{len(errors)} erori detectate",
    }
