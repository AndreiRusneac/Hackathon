import json
import secrets
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import Document, ShareScanLog, ShareToken, User
from ..schemas.schemas import ShareTokenCreate, ShareTokenResponse

router = APIRouter(prefix="/sharing", tags=["sharing"])


def _serialize_token(t: ShareToken) -> ShareTokenResponse:
    return ShareTokenResponse(
        id=t.id,
        token=t.token,
        document_ids=json.loads(t.document_ids),
        permissions=json.loads(t.permissions) if t.permissions else ["read"],
        context=t.context,
        expires_at=t.expires_at,
        use_count=t.use_count,
        max_uses=t.max_uses,
        is_active=t.is_active and t.expires_at > datetime.utcnow(),
        created_at=t.created_at,
    )


@router.post("/tokens", response_model=ShareTokenResponse)
def create_share_token(
    data: ShareTokenCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    # Verify all documents belong to current user
    for doc_id in data.document_ids:
        doc = db.query(Document).filter(
            Document.id == doc_id, Document.owner_id == current_user.id
        ).first()
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Documentul {doc_id} nu a fost găsit sau nu îți aparține",
            )

    token_value = secrets.token_urlsafe(32)
    token = ShareToken(
        creator_id=current_user.id,
        token=token_value,
        document_ids=json.dumps(data.document_ids),
        permissions=json.dumps(data.permissions),
        context=data.context,
        recipient_role=data.recipient_role,
        expires_at=datetime.utcnow() + timedelta(hours=data.expires_hours),
        max_uses=1,
    )
    db.add(token)
    db.flush()

    add_audit_entry(
        db,
        action="QR_TOKEN_CREATE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={
            "context": data.context,
            "expires_hours": data.expires_hours,
            "doc_count": len(data.document_ids),
        },
    )
    db.commit()
    db.refresh(token)
    return _serialize_token(token)


@router.get("/tokens", response_model=List[ShareTokenResponse])
def list_my_tokens(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    tokens = (
        db.query(ShareToken)
        .filter(ShareToken.creator_id == current_user.id)
        .order_by(ShareToken.created_at.desc())
        .limit(20)
        .all()
    )
    return [_serialize_token(t) for t in tokens]


@router.get("/scan/{token_value}")
def scan_token(
    token_value: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Funcționar scans a QR token to view shared documents."""
    token = db.query(ShareToken).filter(ShareToken.token == token_value).first()

    if not token:
        raise HTTPException(status_code=404, detail="Token negăsit")
    if not token.is_active:
        raise HTTPException(status_code=410, detail="Token dezactivat")
    if token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Token expirat")
    if token.use_count >= token.max_uses:
        raise HTTPException(status_code=410, detail="Token deja utilizat")

    # Record scan
    token.use_count += 1
    if token.use_count >= token.max_uses:
        token.is_active = False

    scan_log = ShareScanLog(
        token_id=token.id,
        scanned_by=current_user.id,
    )
    db.add(scan_log)
    db.flush()

    doc_ids = json.loads(token.document_ids)
    docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()

    owner = db.query(User).filter(User.id == token.creator_id).first()

    add_audit_entry(
        db,
        action="QR_TOKEN_SCAN",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_user_id=token.creator_id,
        metadata={
            "context": token.context,
            "token_id": token.id,
            "scanned_docs": len(docs),
        },
    )
    db.commit()

    from ..api.documents import _doc_status
    from ..crypto.vault import decrypt as _vault_decrypt

    def _safe_decrypt(value: str | None, owner_id: str) -> str | None:
        """Never let one undecryptable field (mismatched key, corrupt data)
        500 the whole scan — degrade that field to None instead."""
        try:
            return _vault_decrypt(value, owner_id)
        except Exception:
            return None

    return {
        "owner": {
            "full_name": owner.full_name if owner else "Necunoscut",
            "cnp": owner.cnp if owner else "",
        },
        "context": token.context,
        "permissions": json.loads(token.permissions) if token.permissions else ["read"],
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "doc_number": _safe_decrypt(d.doc_number, d.owner_id),
                "issued_by": _safe_decrypt(d.issued_by, d.owner_id),
                "expires_date": d.expires_date.isoformat() if d.expires_date else None,
                "is_verified": d.is_verified,
                "status": _doc_status(d.expires_date)[0],
            }
            for d in docs
        ],
    }


@router.delete("/tokens/{token_id}")
def revoke_token(
    token_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    token = db.query(ShareToken).filter(
        ShareToken.id == token_id, ShareToken.creator_id == current_user.id
    ).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token negăsit")

    token.is_active = False
    add_audit_entry(
        db,
        action="QR_TOKEN_REVOKE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"token_id": token_id},
    )
    db.commit()
    return {"message": "Token revocat"}
