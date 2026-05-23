import json
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..database import get_db
from ..ledger import verify_chain
from ..models.models import AuditEntry, User
from ..schemas.schemas import AuditEntryResponse, ChainVerifyResponse

router = APIRouter(prefix="/audit", tags=["audit"])


def _serialize_entry(e: AuditEntry) -> AuditEntryResponse:
    meta = {}
    if e.metadata_json:
        try:
            meta = json.loads(e.metadata_json)
        except Exception:
            pass
    return AuditEntryResponse(
        id=e.id,
        timestamp=e.timestamp,
        action=e.action,
        actor_id=e.actor_id,
        actor_name=e.actor_name,
        actor_role=e.actor_role,
        target_document_id=e.target_document_id,
        target_user_id=e.target_user_id,
        metadata=meta,
        prev_hash=e.prev_hash,
        hash=e.hash,
        block_number=e.block_number,
    )


@router.get("/entries", response_model=List[AuditEntryResponse])
def list_audit_entries(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    Cetățean sees their own entries.
    Funcționar/sistem sees all entries.
    """
    query = db.query(AuditEntry).order_by(AuditEntry.block_number.desc())

    if current_user.role == "cetățean":
        query = query.filter(
            (AuditEntry.actor_id == current_user.id)
            | (AuditEntry.target_user_id == current_user.id)
        )

    entries = query.offset(offset).limit(limit).all()
    return [_serialize_entry(e) for e in entries]


@router.get("/verify", response_model=ChainVerifyResponse)
def verify_ledger(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    return verify_chain(db)


@router.get("/stats")
def audit_stats(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Aggregate counts for the audit dashboard, scoped to the citizen's own
    entries (funcționar/sistem see global counts)."""
    total = db.query(AuditEntry).count()

    counts_query = db.query(AuditEntry.action, func.count(AuditEntry.id))
    if current_user.role == "cetățean":
        counts_query = counts_query.filter(
            (AuditEntry.actor_id == current_user.id)
            | (AuditEntry.target_user_id == current_user.id)
        )
    by_action = dict(counts_query.group_by(AuditEntry.action).all())

    chain = verify_chain(db)

    return {
        "total_entries": total,
        "user_entries": sum(by_action.values()),
        "by_action": by_action,
        "documents_created": by_action.get("DOCUMENT_UPLOAD", 0),
        "qr_shares": by_action.get("QR_TOKEN_CREATE", 0),
        "delegations": by_action.get("DELEGATION_CREATE", 0),
        "chain_valid": chain["valid"],
    }
