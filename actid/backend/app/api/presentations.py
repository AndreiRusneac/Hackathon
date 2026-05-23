"""
EUDI Presentations — Selective Disclosure VC flow.

Owner: Radu (eudi/mvp-radu) per API_CONTRACT.md §2.2 + §2.3
  * POST /api/presentations            — citizen creates a selectively-disclosed presentation
  * GET  /api/presentations/{id}/scan  — funcționar verifies + sees only disclosed attrs
"""
import json
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep, require_role
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import Document, PresentationLog, User
from ..schemas.schemas import (
    PresentationCreatePayload,
    PresentationCreateResult,
    PresentationVerifyResult,
    VerifiedIssuer,
)
from ..trust.registry import get_issuer, trusted_jwks
from ..vc.sd_jwt import filter_disclosures, sign_sd_jwt, verify_sd_jwt

router = APIRouter(prefix="/presentations", tags=["presentations"])


# ── vct mapping per API_CONTRACT.md §1.2 ────────────────────────────────────
_VCT_MAP = {
    "CI": "RomanianID",
    "PASAPORT": "Passport",
    "PERMIS": "DriverLicense",
}


def _vct_for_doc(doc_type: str) -> str:
    return _VCT_MAP.get(doc_type.upper(), "GenericAttestation")


def _doc_attributes(doc: Document, owner: User) -> dict[str, Any]:
    """Build the full attribute set that the issuer would sign for this doc."""
    given_name, _, family_name = (owner.full_name or "").partition(" ")

    attrs: dict[str, Any] = {
        "given_name": given_name or owner.full_name or "",
        "family_name": family_name or "",
        "cnp": doc.cnp or owner.cnp or "",
        "document_number": doc.doc_number or "",
        "issued_by": doc.issued_by or "",
        "issue_date": doc.issued_date.isoformat() if doc.issued_date else "",
        "expiry_date": doc.expires_date.isoformat() if doc.expires_date else "",
        "doc_type": doc.doc_type,
    }

    # Derived "over_18" / "over_65" — citizen birth year is encoded in the CNP
    # (positions 2..3 for year, sex digit at position 1 disambiguates century).
    cnp = owner.cnp or ""
    if len(cnp) == 13 and cnp.isdigit():
        sex_digit = int(cnp[0])
        yy = int(cnp[1:3])
        century = {1: 1900, 2: 1900, 3: 1800, 4: 1800, 5: 2000, 6: 2000}.get(sex_digit, 1900)
        year = century + yy
        try:
            mm = int(cnp[3:5])
            dd = int(cnp[5:7])
            from datetime import date as _date
            birth = _date(year, mm, dd)
            today = datetime.utcnow().date()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            attrs["birth_date"] = birth.isoformat()
            attrs["over_18"] = age >= 18
            attrs["over_65"] = age >= 65
        except Exception:
            pass

    return attrs


# ─── 2.2 Create presentation ─────────────────────────────────────────────────

@router.post("", response_model=PresentationCreateResult, status_code=201)
def create_presentation(
    payload: PresentationCreatePayload,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == payload.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document inexistent")
    if doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nu ești proprietarul acestui document")
    if not payload.disclosed_attributes:
        raise HTTPException(status_code=400, detail="Trebuie să dezvălui cel puțin un atribut")

    full_attrs = _doc_attributes(doc, current_user)
    vct = _vct_for_doc(doc.doc_type)

    # 1) Issuer signs full SD-JWT with all available attributes
    sd_jwt_full = sign_sd_jwt(vct=vct, subject_id=current_user.id, attributes=full_attrs)

    # 2) Filter disclosures down to what the user agreed to share
    sd_jwt_presented = filter_disclosures(sd_jwt_full, keep_claims=payload.disclosed_attributes)

    presentation = PresentationLog(
        creator_id=current_user.id,
        document_id=doc.id,
        sd_jwt=sd_jwt_presented,
        disclosed_attrs=json.dumps(payload.disclosed_attributes),
        purpose=payload.purpose,
        verifier_role=payload.verifier_role or "funcționar",
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(presentation)
    db.flush()

    add_audit_entry(
        db,
        action="PRESENTATION_CREATED",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc.id,
        metadata={
            "presentation_id": presentation.id,
            "vct": vct,
            "disclosed": payload.disclosed_attributes,
            "purpose": payload.purpose,
        },
    )
    db.commit()
    db.refresh(presentation)

    return PresentationCreateResult(
        presentation_id=presentation.id,
        qr_url=f"/verify/{presentation.id}",
        expires_at=presentation.expires_at,
        disclosed_attributes=payload.disclosed_attributes,
    )


# ─── 2.3 Verify presentation (funcționar only) ───────────────────────────────

@router.get("/{presentation_id}/scan", response_model=PresentationVerifyResult)
def scan_presentation(
    presentation_id: str,
    current_user: User = Depends(require_role("funcționar")),
    db: Session = Depends(get_db),
):
    pres = db.query(PresentationLog).filter(PresentationLog.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Prezentare necunoscută")

    if pres.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Prezentare expirată")
    if pres.used_at is not None:
        raise HTTPException(status_code=410, detail="Prezentare deja folosită")

    verification = verify_sd_jwt(pres.sd_jwt, trusted_jwks())

    if not verification["valid"]:
        raise HTTPException(
            status_code=422,
            detail={"valid": False, "errors": verification["errors"]},
        )

    issuer_meta = get_issuer(verification["issuer_id"])
    if not issuer_meta:
        raise HTTPException(
            status_code=422,
            detail={"valid": False, "errors": [f"Issuer {verification['issuer_id']} nu este de încredere"]},
        )

    verified_at = datetime.utcnow()
    pres.used_at = verified_at
    pres.scanned_by = current_user.id

    add_audit_entry(
        db,
        action="PRESENTATION_VERIFIED",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=pres.document_id,
        target_user_id=pres.creator_id,
        metadata={
            "presentation_id": pres.id,
            "issuer_id": verification["issuer_id"],
            "vct": verification["vct"],
            "disclosed_keys": list(verification["disclosed_attributes"].keys()),
            "purpose": pres.purpose,
        },
    )
    db.commit()

    return PresentationVerifyResult(
        valid=True,
        issuer=VerifiedIssuer(
            id=issuer_meta["id"],
            name=issuer_meta["name"],
            trusted=True,
            country=issuer_meta["country"],
        ),
        credential_type=verification["vct"],
        disclosed_attributes=verification["disclosed_attributes"],
        purpose=pres.purpose,
        verified_at=verified_at,
    )
