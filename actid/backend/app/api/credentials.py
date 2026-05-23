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
from ..vc.sd_jwt import ISSUER_URL
from ..database import get_db
from ..models.models import AuditEntry, Document, User
from ..vc.issuer import get_available_attributes, get_vct, issue_credential

router = APIRouter(tags=["wallet"])

# Actions considered "presentation events" for history
_PRESENTATION_ACTIONS = {"DOCUMENT_VIEW", "SHARE_TOKEN_SCANNED", "CREDENTIAL_ISSUED"}


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
    Shows JWK fingerprint, algorithm, and encryption-at-rest info.
    """
    try:
        jwk = get_issuer_public_jwk()
        fingerprint = get_issuer_fingerprint()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Cheile issuer-ului nu sunt generate. Repornește serverul.",
        )

    return {
        "issuer_url": ISSUER_URL,
        "issuer_kid": get_issuer_kid(),
        "issuer_alg": ISSUER_ALG,
        "issuer_fingerprint": fingerprint,
        "issuer_jwk": jwk,
        "vault_encryption": "AES-256-GCM",
        "vault_kdf": "HKDF-SHA256",
        "sd_jwt_spec": "SD-JWT VC (IETF draft-ietf-oauth-sd-jwt-vc)",
        "eidas_compliance": "eIDAS 2.0 ARF 1.4",
    }


# ── GET /api/wallet/presentations-history ────────────────────────────────────

@router.get("/wallet/presentations-history")
def presentations_history(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
    limit: int = 50,
) -> list[dict[str, Any]]:
    """
    Return the presentation/view history for the current user's documents,
    sourced from the tamper-evident audit log.
    """
    entries = (
        db.query(AuditEntry)
        .filter(
            AuditEntry.actor_id == current_user.id,
            AuditEntry.action.in_(_PRESENTATION_ACTIONS),
        )
        .order_by(AuditEntry.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": e.id,
            "action": e.action,
            "timestamp": e.timestamp.isoformat(),
            "target_document_id": e.target_document_id,
            "actor_role": e.actor_role,
            "block_number": e.block_number,
            "hash": e.hash,
        }
        for e in entries
    ]
