"""
Debug endpoints — pentru pagina ascunsă de demo a criptării.

⚠️  Aceste endpoint-uri întorc date BRUTE (criptate) din DB ca să poată fi
afișate side-by-side cu plaintext-ul. NU sunt linkate în UI, doar accesate
prin URL direct: /debug/encryption-proof/:doc_id

Restricții de securitate:
  - Auth obligatorie (Bearer JWT)
  - Owner-only — vezi doar documentele tale (filter pe owner_id)
  - În producție: gate-uit pe ENV var sau dezactivat complet
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..api.documents import _doc_status
from ..crypto.vault import decrypt as vault_decrypt, encryption_version
from ..database import get_db
from ..models.models import Document, User

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/raw-document/{doc_id}")
def get_raw_document(
    doc_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Returnează documentul în DOUĂ forme paralele:
      - 'server_view' = exact ce e în DB (ciphertext brut)
      - 'user_view'   = decriptat cu cheia ta personală
      - 'encryption'  = ce algoritm folosește fiecare câmp
    """
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.owner_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document negăsit (sau nu îți aparține)")

    uid = doc.owner_id
    status, days = _doc_status(doc.expires_date)

    # Encrypted-or-not status per field
    enc_status = {
        "doc_number":    encryption_version(doc.doc_number),
        "issued_by":     encryption_version(doc.issued_by),
        "description":   encryption_version(doc.description),
        "cnp":           encryption_version(doc.cnp),
        "photo_base64":  encryption_version(doc.photo_base64),
    }

    return {
        "doc_id": doc.id,
        # Always plaintext (indexable fields)
        "plaintext_fields": {
            "doc_type":      doc.doc_type,
            "owner_id":      doc.owner_id,
            "issued_date":   doc.issued_date.isoformat() if doc.issued_date else None,
            "expires_date":  doc.expires_date.isoformat() if doc.expires_date else None,
            "is_verified":   doc.is_verified,
            "status":        status,
            "days_remaining": days,
            "created_at":    doc.created_at.isoformat() if doc.created_at else None,
        },
        # What the database stores (raw, no decryption)
        "server_view": {
            "doc_number":    doc.doc_number,
            "issued_by":     doc.issued_by,
            "description":   doc.description,
            "cnp":           doc.cnp,
            "photo_base64":  doc.photo_base64,
        },
        # What you (the owner) see after decryption with your per-user key
        "user_view": {
            "doc_number":    vault_decrypt(doc.doc_number, uid),
            "issued_by":     vault_decrypt(doc.issued_by, uid),
            "description":   vault_decrypt(doc.description, uid),
            "cnp":           vault_decrypt(doc.cnp, uid),
            "photo_base64":  vault_decrypt(doc.photo_base64, uid),
        },
        # Encryption metadata for the UI
        "encryption": {
            "algorithm":         "AES-256-GCM",
            "key_derivation":    "HKDF-SHA256 (SECRET_KEY + user_id)",
            "per_field_status":  enc_status,
            "user_id":           uid,
            "key_fingerprint":   f"hkdf-sha256(secret_key + '{uid[:8]}...')",
        },
    }


@router.get("/my-documents-list")
def list_my_documents_for_demo(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Lista minimală a documentelor curentului user, pentru picker-ul demo.
    Returnează doar id, doc_type, encryption status — fără date sensibile decriptate.
    """
    docs = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return {
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "is_verified": d.is_verified,
                "doc_number_status": encryption_version(d.doc_number),
                "cnp_status": encryption_version(d.cnp),
            }
            for d in docs
        ],
    }
