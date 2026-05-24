import json
import random
import string
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..crypto.face_generator import fetch_ai_face, gender_from_cnp
from ..crypto.vault import decrypt as vault_decrypt, encrypt as vault_encrypt
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import DelegationGrant, Document, User

# Document types that should have a portrait photo
_PHOTO_DOC_TYPES = {"CI", "PASAPORT", "PERMIS"}
from ..schemas.schemas import (
    DocumentCatalogItem,
    DocumentCreate,
    DocumentRequestPayload,
    DocumentResponse,
    RenewalRequestCreate,
    RenewalRequestResponse,
)

router = APIRouter(prefix="/documents", tags=["documents"])


# ── Catalog: doc_type → label, issuing authority, default validity ──────────
_CATALOG: dict[str, dict] = {
    # Identitate
    "CI":                    {"label": "Carte de Identitate",            "issuer": "SPCLEP Cluj-Napoca",          "validity_days": 3650, "category": "identitate"},
    "PASAPORT":              {"label": "Pașaport",                       "issuer": "MAI - Direcția Pașapoarte",   "validity_days": 3650, "category": "identitate"},
    "CERT_CETATENIE":        {"label": "Certificat de Cetățenie",        "issuer": "Ministerul Justiției",        "validity_days": None, "category": "identitate"},
    "CAZIER":                {"label": "Cazier Judiciar",                "issuer": "IPJ Cluj",                    "validity_days": 180,  "category": "identitate"},
    # Familie & Stare Civilă
    "CERT_NASTERE":          {"label": "Certificat de Naștere",          "issuer": "Primăria Cluj-Napoca",        "validity_days": None, "category": "familie"},
    "CERT_CASATORIE":        {"label": "Certificat de Căsătorie",        "issuer": "Primăria Cluj-Napoca",        "validity_days": None, "category": "familie"},
    "CERT_DECES":            {"label": "Certificat de Deces",            "issuer": "Primăria Cluj-Napoca",        "validity_days": None, "category": "familie"},
    "LIVRET_FAMILIE":        {"label": "Livret de Familie",              "issuer": "Primăria Cluj-Napoca",        "validity_days": None, "category": "familie"},
    # Domiciliu & Acte Juridice
    "ADEVERINTA_DOMICILIU":  {"label": "Adeverință de Domiciliu",        "issuer": "Primăria Cluj-Napoca",        "validity_days": 90,   "category": "domiciliu"},
    "PROCURA":               {"label": "Procură Notarială",              "issuer": "Notariat Public Cluj",        "validity_days": 365,  "category": "domiciliu"},
    # Muncă & Venituri
    "ADEVERINTA_VENIT":      {"label": "Adeverință de Venit",            "issuer": "ANAF Cluj",                   "validity_days": 30,   "category": "munca"},
    "CONTRACT_MUNCA":        {"label": "Contract de Muncă",              "issuer": "ITM Cluj",                    "validity_days": None, "category": "munca"},
    # Educație
    "DIPLOMA_BAC":           {"label": "Diplomă de Bacalaureat",         "issuer": "Ministerul Educației",        "validity_days": None, "category": "educatie"},
    "DIPLOMA_LICENTA":       {"label": "Diplomă de Licență",             "issuer": "Universitatea Babeș-Bolyai",  "validity_days": None, "category": "educatie"},
    "CERT_COMPETENTE":       {"label": "Certificat de Competențe",       "issuer": "ANC - Autoritatea Națională", "validity_days": 1825, "category": "educatie"},
    # Sănătate
    "CARD_SANATATE":         {"label": "Card de Sănătate CNAS",          "issuer": "CNAS Cluj",                   "validity_days": 1825, "category": "sanatate"},
    "CERT_HANDICAP":         {"label": "Certificat de Handicap",         "issuer": "DGASPC Cluj",                 "validity_days": 365,  "category": "sanatate"},
    "ECUSON_PARCARE":        {"label": "Ecuson Parcare Dizabilități",    "issuer": "Primăria Cluj-Napoca",        "validity_days": 1825, "category": "sanatate"},
    # Vehicul & Transport
    "PERMIS":                {"label": "Permis de Conducere",            "issuer": "RAR Cluj",                    "validity_days": 3650, "category": "vehicul"},
    "TALON":                 {"label": "Certificat de Înmatriculare",    "issuer": "RAR Cluj",                    "validity_days": None, "category": "vehicul"},
    "INMATRICULARE_TEMP":    {"label": "Înmatriculare Temporară",        "issuer": "RAR Cluj",                    "validity_days": 30,   "category": "vehicul"},
    "ITP":                   {"label": "ITP",                            "issuer": "Centru ITP Autorizat",        "validity_days": 730,  "category": "vehicul"},
    "ASIGURARE":             {"label": "Asigurare RCA",                  "issuer": "ASF - Companie Asigurări",    "validity_days": 365,  "category": "vehicul"},
    "ROVINIETA":             {"label": "Rovinietă",                      "issuer": "CNAIR",                       "validity_days": 365,  "category": "vehicul"},
}


def _generate_doc_number(doc_type: str) -> str:
    """Realistic-looking Romanian doc numbers per type."""
    rand_digits = lambda n: "".join(random.choices(string.digits, k=n))
    if doc_type == "CI":
        return f"CJ{rand_digits(6)}"
    if doc_type == "PASAPORT":
        return f"RO{rand_digits(7)}"
    if doc_type == "PERMIS":
        return f"CJ{rand_digits(6)}"
    if doc_type == "CAZIER":
        return f"CZ{datetime.utcnow().year}-{rand_digits(4)}"
    if doc_type == "ROVINIETA":
        return f"RO-{datetime.utcnow().year}-{''.join(random.choices(string.ascii_uppercase, k=2))}{rand_digits(4)}"
    if doc_type.startswith("CERT_"):
        prefix = doc_type.split("_", 1)[1][:2].upper()
        return f"{prefix}-{datetime.utcnow().year}-{rand_digits(4)}"
    if doc_type == "DIPLOMA_BAC":
        return f"BAC-{datetime.utcnow().year}-{rand_digits(5)}"
    if doc_type == "DIPLOMA_LICENTA":
        return f"LIC-{datetime.utcnow().year}-{rand_digits(5)}"
    if doc_type == "ITP":
        return f"ITP-{rand_digits(8)}"
    if doc_type == "ASIGURARE":
        return f"RCA-{rand_digits(10)}"
    if doc_type == "TALON":
        return f"CJ{rand_digits(6)}"
    # Generic fallback
    return f"{doc_type[:3]}-{rand_digits(6)}"


def _doc_status(expires_date: Optional[date]) -> tuple[str, Optional[int]]:
    if expires_date is None:
        return "valid", None
    today = datetime.now(timezone.utc).date()
    delta = (expires_date - today).days
    if delta < 0:
        return "expirat", delta
    if delta <= 30:
        return "expiră_curând", delta
    return "valid", delta


def _serialize_doc(doc: Document) -> DocumentResponse:
    """Decrypts all sensitive fields with the owner's per-user key."""
    status, days = _doc_status(doc.expires_date)
    uid = doc.owner_id
    return DocumentResponse(
        id=doc.id,
        owner_id=doc.owner_id,
        doc_type=doc.doc_type,
        doc_number=vault_decrypt(doc.doc_number, uid),
        issued_by=vault_decrypt(doc.issued_by, uid),
        issued_date=doc.issued_date,
        expires_date=doc.expires_date,
        is_verified=doc.is_verified,
        description=vault_decrypt(doc.description, uid),
        photo_base64=vault_decrypt(doc.photo_base64, uid),
        cnp=vault_decrypt(doc.cnp, uid),
        created_at=doc.created_at,
        days_remaining=days,
        status=status,
    )


@router.post("/renewal-request", response_model=RenewalRequestResponse)
def request_renewal(
    data: RenewalRequestCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == data.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document negăsit")

    if doc.owner_id != current_user.id:
        grant = (
            db.query(DelegationGrant)
            .filter(
                DelegationGrant.delegator_id == doc.owner_id,
                DelegationGrant.delegate_id == current_user.id,
                DelegationGrant.is_active.is_(True),
            )
            .first()
        )
        if not grant:
            raise HTTPException(status_code=403, detail="Acces interzis")
        permissions = json.loads(grant.permissions)
        if "request_renewal" not in permissions:
            raise HTTPException(status_code=403, detail="Nu ai permisiunea de a solicita reînnoirea")

    add_audit_entry(
        db,
        action="RENEWAL_REQUEST",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc.id,
        target_user_id=doc.owner_id,
        metadata={"note": data.note, "requested_by": current_user.email, "doc_type": doc.doc_type},
    )
    db.commit()
    return RenewalRequestResponse(success=True, message="Cerere înregistrată")


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    if current_user.role == "funcționar":
        raise HTTPException(status_code=403, detail="Funcționarul nu poate accesa documentele cetățenilor")
    docs = db.query(Document).filter(Document.owner_id == current_user.id).all()
    return [_serialize_doc(d) for d in docs]


@router.get("/delegated", response_model=List[dict])
def list_delegated_documents(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Documents delegated to the current user by family members."""
    now = datetime.utcnow()
    grants = (
        db.query(DelegationGrant)
        .filter(
            DelegationGrant.delegate_id == current_user.id,
            DelegationGrant.is_active.is_(True),
            (DelegationGrant.valid_until == None) | (DelegationGrant.valid_until > now),
        )
        .all()
    )

    result = []
    for grant in grants:
        delegator = db.query(User).filter(User.id == grant.delegator_id).first()
        if not delegator:
            continue

        categories = json.loads(grant.document_categories)
        docs = (
            db.query(Document)
            .filter(
                Document.owner_id == grant.delegator_id,
                Document.doc_type.in_(categories),
            )
            .all()
        )

        for doc in docs:
            status, days = _doc_status(doc.expires_date)
            result.append({
                **_serialize_doc(doc).model_dump(),
                "delegated_from": {
                    "id": delegator.id,
                    "full_name": delegator.full_name,
                    "city": delegator.city,
                    "country": delegator.country,
                },
                "delegation_permissions": json.loads(grant.permissions),
                "delegation_id": grant.id,
            })

    return result


@router.get("/catalog", response_model=List[DocumentCatalogItem])
def documents_catalog(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    EUDI-style catalog: all document types a citizen can request from the state.
    For each, returns whether the user already has it and whether it's expired.
    """
    if current_user.role == "funcționar":
        raise HTTPException(status_code=403, detail="Indisponibil pentru funcționar")

    owned = db.query(Document).filter(Document.owner_id == current_user.id).all()
    by_type: dict[str, Document] = {d.doc_type: d for d in owned}

    items: List[DocumentCatalogItem] = []
    for doc_type, meta in _CATALOG.items():
        existing = by_type.get(doc_type)
        if existing is None:
            state = "missing"
            existing_id = None
        else:
            status, _ = _doc_status(existing.expires_date)
            state = "expired" if status == "expirat" else "owned"
            existing_id = existing.id
        items.append(DocumentCatalogItem(
            doc_type=doc_type,
            label=meta["label"],
            category=meta["category"],
            issuing_authority=meta["issuer"],
            validity_days=meta["validity_days"],
            state=state,
            existing_document_id=existing_id,
        ))
    return items


@router.post("/request", response_model=DocumentResponse)
def request_document(
    payload: DocumentRequestPayload,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    EUDI-style instant issuance from a simulated governmental agency.
    - If user has no doc of this type → create new
    - If user has an EXPIRED doc → delete old + create new (renewal)
    - If user has a VALID doc → 409 conflict
    Issued documents are flagged is_verified=True (Document Oficial badge).
    """
    if current_user.role == "funcționar":
        raise HTTPException(status_code=403, detail="Funcționarul nu poate solicita documente")

    meta = _CATALOG.get(payload.doc_type)
    if meta is None:
        raise HTTPException(status_code=400, detail=f"Tip document necunoscut: {payload.doc_type}")

    existing = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id, Document.doc_type == payload.doc_type)
        .first()
    )
    action = "DOCUMENT_REQUESTED"
    if existing is not None:
        status, _ = _doc_status(existing.expires_date)
        if status != "expirat":
            raise HTTPException(status_code=409, detail="Ai deja acest document în portofel")
        db.delete(existing)
        db.flush()
        action = "DOCUMENT_RENEWED"

    today = datetime.now(timezone.utc).date()
    expires = (today + timedelta(days=meta["validity_days"])) if meta["validity_days"] else None

    uid = current_user.id
    cnp_value = current_user.cnp if payload.doc_type in {"CI", "PASAPORT"} else None

    # Identity docs (CI / PASAPORT / PERMIS) get an AI-generated portrait.
    # Reuse the face across all of a user's identity docs so they look like
    # the same person; only fetch a new one if this is their first identity doc.
    # Also BACKFILL any existing identity docs that lack a photo (e.g. seeded).
    photo_data: str | None = None
    if payload.doc_type in _PHOTO_DOC_TYPES:
        existing_with_photo = (
            db.query(Document)
            .filter(
                Document.owner_id == uid,
                Document.doc_type.in_(_PHOTO_DOC_TYPES),
                Document.photo_base64.isnot(None),
            )
            .first()
        )
        if existing_with_photo:
            photo_data = vault_decrypt(existing_with_photo.photo_base64, uid)
        else:
            gender = gender_from_cnp(current_user.cnp)
            photo_data = fetch_ai_face(gender)  # may be None on network failure

        # Backfill: copy this face onto any seeded/older identity docs lacking one
        if photo_data:
            photoless = (
                db.query(Document)
                .filter(
                    Document.owner_id == uid,
                    Document.doc_type.in_(_PHOTO_DOC_TYPES),
                    Document.photo_base64.is_(None),
                )
                .all()
            )
            encrypted_photo = vault_encrypt(photo_data, uid)
            for d in photoless:
                d.photo_base64 = encrypted_photo

    doc = Document(
        owner_id=uid,
        doc_type=payload.doc_type,
        doc_number=vault_encrypt(_generate_doc_number(payload.doc_type), uid),
        issued_by=vault_encrypt(meta["issuer"], uid),
        issued_date=today,
        expires_date=expires,
        description=vault_encrypt(meta["label"], uid),
        cnp=vault_encrypt(cnp_value, uid),
        photo_base64=vault_encrypt(photo_data, uid),
        is_verified=True,
    )
    db.add(doc)
    db.flush()

    add_audit_entry(
        db,
        action=action,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc.id,
        metadata={
            "doc_type": payload.doc_type,
            "issuer": meta["issuer"],
            "channel": "EUDI Wallet — emitere instantă simulată",
        },
    )
    db.commit()
    db.refresh(doc)
    return _serialize_doc(doc)


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    if current_user.role == "funcționar":
        raise HTTPException(status_code=403, detail="Funcționarul nu poate accesa documentele cetățenilor")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document negăsit")

    # Check ownership or delegation
    if doc.owner_id != current_user.id:
        grant = (
            db.query(DelegationGrant)
            .filter(
                DelegationGrant.delegator_id == doc.owner_id,
                DelegationGrant.delegate_id == current_user.id,
                DelegationGrant.is_active.is_(True),
            )
            .first()
        )
        if not grant:
            raise HTTPException(status_code=403, detail="Acces interzis")

    add_audit_entry(
        db,
        action="DOCUMENT_VIEW",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc_id,
        metadata={"doc_type": doc.doc_type, "owner_id": doc.owner_id},
    )
    db.commit()

    return _serialize_doc(doc)


@router.post("/", response_model=DocumentResponse)
def create_document(
    data: DocumentCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    if current_user.role == "funcționar":
        raise HTTPException(status_code=403, detail="Funcționarul nu poate crea documente")

    uid = current_user.id
    doc = Document(
        owner_id=uid,
        doc_type=data.doc_type,
        doc_number=vault_encrypt(data.doc_number, uid),
        issued_by=vault_encrypt(data.issued_by, uid),
        issued_date=data.issued_date,
        expires_date=data.expires_date,
        description=vault_encrypt(data.description, uid),
        photo_base64=vault_encrypt(data.photo_base64, uid),
        cnp=vault_encrypt(data.cnp, uid),
        is_verified=False,
    )
    db.add(doc)
    db.flush()

    add_audit_entry(
        db,
        action="DOCUMENT_UPLOAD",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc.id,
        metadata={"doc_type": data.doc_type},
    )
    db.commit()
    db.refresh(doc)
    return _serialize_doc(doc)


@router.post("/refresh-photo")
def refresh_identity_photo(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    Fetches a fresh AI face and applies it to ALL the user's identity docs
    (CI / PASAPORT / PERMIS). Used when the previously generated face doesn't
    match the user's gender (the source service has no gender filter).
    """
    if current_user.role == "funcționar":
        raise HTTPException(status_code=403, detail="Indisponibil pentru funcționar")

    new_face = fetch_ai_face()
    if not new_face:
        raise HTTPException(status_code=503, detail="Nu am putut obține o poză nouă. Încearcă din nou.")

    uid = current_user.id
    encrypted = vault_encrypt(new_face, uid)

    docs = (
        db.query(Document)
        .filter(Document.owner_id == uid, Document.doc_type.in_(_PHOTO_DOC_TYPES))
        .all()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="Nu ai documente de identitate")

    for d in docs:
        d.photo_base64 = encrypted

    add_audit_entry(
        db,
        action="PHOTO_REGENERATED",
        actor_id=uid,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"affected_docs": len(docs), "doc_types": [d.doc_type for d in docs]},
    )
    db.commit()
    return {"success": True, "updated_count": len(docs)}


@router.delete("/{doc_id}")
def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document negăsit")

    add_audit_entry(
        db,
        action="DOCUMENT_DELETE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc_id,
        metadata={"doc_type": doc.doc_type},
    )
    db.delete(doc)
    db.commit()
    return {"message": "Document șters"}
