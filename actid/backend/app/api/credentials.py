"""
api/credentials.py — EUDI Wallet credential endpoints.

Implements the issuance side of the SD-JWT VC flow:
  GET /api/credentials/{doc_id}         — issue SD-JWT VC for a document
  GET /api/wallet/security              — issuer trust info (JWK, fingerprint)
  GET /api/wallet/presentations-history — audit log of document views/presentations
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..crypto.keys import (
    ISSUER_ALG,
    get_issuer_fingerprint,
    get_issuer_public_jwk,
    get_issuer_kid,
)
from ..trust.registry import load_issuers
from ..vc.sd_jwt import ISSUER_URL
from ..database import get_db
from ..models.models import Document, PresentationLog, User
from ..vc.issuer import get_available_attributes, get_vct, issue_credential

router = APIRouter(tags=["wallet"])



# ── GET /api/credentials/{doc_id} ────────────────────────────────────────────

@router.get("/credentials/{doc_id}")
def get_credential(
    doc_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Issue a signed SD-JWT VC for the given document.
    Only the document owner can request issuance.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document negăsit")
    if doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acces interzis")

    try:
        sd_jwt = issue_credential(document=doc, owner=current_user)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Eroare la emiterea credențialei: {exc}")

    return {
        "credential_sd_jwt": sd_jwt,
        "vct": get_vct(doc),
        "issuer_id": ISSUER_URL,
        "attributes_available": get_available_attributes(doc, current_user),
    }


# ── GET /api/wallet/security ─────────────────────────────────────────────────

@router.get("/wallet/security")
def wallet_security(
    current_user: User = Depends(get_current_user_dep),
) -> dict[str, Any]:
    """
    Return issuer trust metadata for the Security page.
    Response shape matches the WalletSecurity TypeScript type in api.ts.
    """
    try:
        fingerprint = get_issuer_fingerprint()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Cheile issuer-ului nu sunt generate. Repornește serverul.",
        )

    issuers = [
        {
            "id": iss["id"],
            "name": iss["name"],
            "country": iss["country"],
            "valid_from": iss["valid_from"],
        }
        for iss in load_issuers()
    ]

    return {
        "wallet_instance_id": f"wia_{current_user.id[:16]}",
        "encryption": {
            "algorithm": "AES-256-GCM / HKDF-SHA256",
            "at_rest_enabled": True,
            "encrypted_fields": ["documents.cnp", "documents.photo_base64"],
        },
        "trusted_issuers": issuers,
        "issuer_public_key_fingerprint": fingerprint,
    }


# ── GET /api/wallet/presentations-history ────────────────────────────────────

@router.get("/wallet/presentations-history")
def presentations_history(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
    limit: int = 50,
) -> dict[str, Any]:
    """
    Return the SD-JWT presentation history for the current user.
    Response shape matches { presentations: PresentationHistoryEntry[] } in api.ts.
    """
    import json as _json

    logs = (
        db.query(PresentationLog)
        .filter(PresentationLog.creator_id == current_user.id)
        .order_by(PresentationLog.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for log in logs:
        doc = db.query(Document).filter(Document.id == log.document_id).first()
        scanned_by_name: str | None = None
        if log.scanned_by:
            scanner = db.query(User).filter(User.id == log.scanned_by).first()
            scanned_by_name = scanner.full_name if scanner else None

        try:
            disclosed = _json.loads(log.disclosed_attrs)
        except Exception:
            disclosed = []

        result.append({
            "id": log.id,
            "document_id": log.document_id,
            "document_type": doc.doc_type if doc else "UNKNOWN",
            "disclosed_attributes": disclosed,
            "purpose": log.purpose,
            "created_at": log.created_at.isoformat(),
            "scanned_at": log.used_at.isoformat() if log.used_at else None,
            "scanned_by_name": scanned_by_name,
        })

    return {"presentations": result}
