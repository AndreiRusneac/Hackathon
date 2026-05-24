"""
EUDI Presentations — Selective Disclosure VC flow.

Owner: Radu (eudi/mvp-radu) per API_CONTRACT.md §2.2 + §2.3
  * POST /api/presentations            — citizen creates a selectively-disclosed presentation
  * GET  /api/presentations/{id}/scan  — funcționar verifies + sees only disclosed attrs
"""
import json
from datetime import datetime, timedelta

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
from ..trust.registry import get_issuer
from ..vc.issuer import build_attributes, get_vct
from ..vc.sd_jwt import (
    ISSUER_URL,
    create_presentation as build_sd_presentation,
    sign_credential,
    verify_presentation,
)

router = APIRouter(prefix="/presentations", tags=["presentations"])


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

    # Single source of truth: the same attributes the wallet UI was offered
    # (GET /api/credentials/{id}) are the ones we sign here.
    full_attrs = build_attributes(doc, current_user)
    vct = get_vct(doc)

    # Only keep requested attributes that actually exist in the credential, so a
    # stale/unknown key can never break the SD-JWT disclosure step.
    disclosed = [a for a in payload.disclosed_attributes if a in full_attrs]
    if not disclosed:
        raise HTTPException(
            status_code=400,
            detail="Atributele selectate nu există în acest document",
        )

    # 1) Issuer signs full SD-JWT with all available attributes
    sd_jwt_full = sign_credential(vct=vct, subject_id=current_user.id, attributes=full_attrs)

    # 2) Filter disclosures down to what the user agreed to share
    sd_jwt_presented = build_sd_presentation(sd_jwt_full, disclosed)

    presentation = PresentationLog(
        creator_id=current_user.id,
        document_id=doc.id,
        sd_jwt=sd_jwt_presented,
        disclosed_attrs=json.dumps(disclosed),
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
            "disclosed": disclosed,
            "purpose": payload.purpose,
        },
    )
    db.commit()
    db.refresh(presentation)

    return PresentationCreateResult(
        presentation_id=presentation.id,
        qr_url=f"/verify/{presentation.id}",
        expires_at=presentation.expires_at,
        disclosed_attributes=disclosed,
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

    verification = verify_presentation(pres.sd_jwt)

    if not verification["valid"]:
        raise HTTPException(
            status_code=422,
            detail={"valid": False, "errors": verification["errors"]},
        )

    # issuer_id from Andrei's verify_presentation is the `iss` URL claim
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
