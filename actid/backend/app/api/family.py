import json
from datetime import datetime, timedelta, date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import CivilRegistry, GovernmentDocRegistry, DelegationGrant, User, ChildProfile, ChildGuardian, ChildDocument
from ..schemas.schemas import (
    DelegationCreate, DelegationResponse,
    ChildResponse, ChildDocumentCreate, ChildDocumentResponse,
    GuardianSummary, AddGuardianRequest,
    RegistryChildResult, MyChildProfileResponse,
    GovDocResult,
)

router = APIRouter(prefix="/family", tags=["family"])


def _serialize_grant(grant: DelegationGrant, db: Session) -> DelegationResponse:
    delegator = db.query(User).filter(User.id == grant.delegator_id).first()
    delegate = db.query(User).filter(User.id == grant.delegate_id).first()
    return DelegationResponse(
        id=grant.id,
        delegator_id=grant.delegator_id,
        delegate_id=grant.delegate_id,
        delegator_name=delegator.full_name if delegator else None,
        delegate_name=delegate.full_name if delegate else None,
        delegate_email=delegate.email if delegate else None,
        document_categories=json.loads(grant.document_categories),
        permissions=json.loads(grant.permissions),
        valid_until=grant.valid_until,
        is_active=grant.is_active,
        consent_timestamp=grant.consent_timestamp,
        notes=grant.notes,
    )


@router.get("/delegations", response_model=List[DelegationResponse])
def list_delegations(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Delegations I've given to others."""
    grants = (
        db.query(DelegationGrant)
        .filter(
            DelegationGrant.delegator_id == current_user.id,
            DelegationGrant.is_active.is_(True),
        )
        .all()
    )
    return [_serialize_grant(g, db) for g in grants]


@router.get("/delegated-to-me", response_model=List[DelegationResponse])
def list_delegated_to_me(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Delegations others have given to me."""
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
    return [_serialize_grant(g, db) for g in grants]


@router.post("/delegations", response_model=DelegationResponse)
def create_delegation(
    data: DelegationCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    delegate = db.query(User).filter(User.email == data.delegate_email).first()
    if not delegate:
        raise HTTPException(status_code=404, detail="Utilizatorul delegat nu a fost găsit")
    if delegate.id == current_user.id:
        raise HTTPException(status_code=400, detail="Nu te poți delega pe tine însuți")

    # Check if active delegation already exists
    existing = (
        db.query(DelegationGrant)
        .filter(
            DelegationGrant.delegator_id == current_user.id,
            DelegationGrant.delegate_id == delegate.id,
            DelegationGrant.is_active.is_(True),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Delegare activă există deja pentru acest utilizator")

    valid_until = None
    if data.valid_days:
        valid_until = datetime.utcnow() + timedelta(days=data.valid_days)

    grant = DelegationGrant(
        delegator_id=current_user.id,
        delegate_id=delegate.id,
        document_categories=json.dumps(data.document_categories),
        permissions=json.dumps(data.permissions),
        valid_until=valid_until,
        notes=data.notes,
    )
    db.add(grant)
    db.flush()

    add_audit_entry(
        db,
        action="DELEGATION_CREATE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_user_id=delegate.id,
        metadata={
            "delegate_name": delegate.full_name,
            "categories": data.document_categories,
            "permissions": data.permissions,
            "valid_days": data.valid_days,
        },
    )
    db.commit()
    db.refresh(grant)
    return _serialize_grant(grant, db)


@router.delete("/delegations/{grant_id}")
def revoke_delegation(
    grant_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    grant = db.query(DelegationGrant).filter(
        DelegationGrant.id == grant_id,
        DelegationGrant.delegator_id == current_user.id,
    ).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Delegare negăsită")

    grant.is_active = False
    grant.revoked_at = datetime.utcnow()

    delegate = db.query(User).filter(User.id == grant.delegate_id).first()
    add_audit_entry(
        db,
        action="DELEGATION_REVOKE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_user_id=grant.delegate_id,
        metadata={"delegate_name": delegate.full_name if delegate else ""},
    )
    db.commit()
    return {"message": "Delegare revocată"}


# ─── Children / Guardians ────────────────────────────────────────────────────


def _child_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _serialize_child(child: ChildProfile, guardian_link: ChildGuardian, db: Session) -> ChildResponse:
    docs = [
        ChildDocumentResponse(
            id=d.id,
            child_id=d.child_id,
            doc_type=d.doc_type,
            doc_number=d.doc_number,
            issued_by=d.issued_by,
            issued_date=d.issued_date,
            expires_date=d.expires_date,
            description=d.description,
            created_at=d.created_at,
        )
        for d in child.documents
    ]
    guardians = [
        GuardianSummary(
            relationship_type=g.relationship_type,
            guardian_name=db.query(User).filter(User.id == g.guardian_id).first().full_name
            if db.query(User).filter(User.id == g.guardian_id).first() else "Necunoscut",
            proof_verified=g.proof_verified,
        )
        for g in child.guardians
        if g.is_active
    ]
    return ChildResponse(
        id=child.id,
        full_name=child.full_name,
        date_of_birth=child.date_of_birth,
        cnp=child.cnp,
        created_at=child.created_at,
        relationship_type=guardian_link.relationship_type,
        proof_type=guardian_link.proof_type,
        proof_verified=guardian_link.proof_verified,
        is_student=any(d.doc_type == "CARNET_ELEV" for d in child.documents),
        documents=docs,
        guardians=guardians,
    )


def _expire_if_adult(child: ChildProfile, db: Session) -> bool:
    """Deactivate all guardian links if the child has turned 18. Returns True if expired."""
    if _child_age(child.date_of_birth) < 18:
        return False
    active_links = db.query(ChildGuardian).filter(
        ChildGuardian.child_id == child.id,
        ChildGuardian.is_active.is_(True),
    ).all()
    if not active_links:
        return True
    for link in active_links:
        link.is_active = False
    add_audit_entry(
        db,
        action="CHILD_GUARDIANS_EXPIRED",
        actor_id=None,
        actor_name="sistem",
        actor_role="sistem",
        metadata={"child_name": child.full_name, "reason": "child turned 18"},
    )
    db.commit()
    return True


def _get_child_as_guardian(child_id: str, current_user: User, db: Session) -> tuple:
    """Returns (child, guardian_link) or raises 404. Also expires on 18th birthday."""
    child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Profil copil negăsit")
    if _expire_if_adult(child, db):
        raise HTTPException(
            status_code=403,
            detail=f"{child.full_name} a împlinit 18 ani. Accesul ca tutore a fost revocat automat.",
        )
    link = db.query(ChildGuardian).filter(
        ChildGuardian.child_id == child_id,
        ChildGuardian.guardian_id == current_user.id,
        ChildGuardian.is_active.is_(True),
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Copil negăsit sau nu ești tutore")
    return child, link


@router.get("/my-child-profile", response_model=MyChildProfileResponse)
def my_child_profile(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Return this user's own ChildProfile — only populated when they were registered as a child
    by a guardian and have since turned 14 and created their own account."""
    profile = db.query(ChildProfile).filter(
        ChildProfile.user_id == current_user.id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Niciun profil de copil asociat")

    docs = [
        ChildDocumentResponse(
            id=d.id, child_id=d.child_id, doc_type=d.doc_type, doc_number=d.doc_number,
            issued_by=d.issued_by, issued_date=d.issued_date, expires_date=d.expires_date,
            description=d.description, created_at=d.created_at,
        )
        for d in profile.documents
    ]
    guardians = [
        GuardianSummary(
            relationship_type=g.relationship_type,
            guardian_name=(db.query(User).filter(User.id == g.guardian_id).first() or User(full_name="Necunoscut")).full_name,
            proof_verified=g.proof_verified,
        )
        for g in profile.guardians
        if g.is_active
    ]
    return MyChildProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        date_of_birth=profile.date_of_birth,
        cnp=profile.cnp,
        documents=docs,
        guardians=guardians,
    )


def _registry_relationship(record: CivilRegistry, user_cnp: str) -> str:
    if record.guardian_cnp == user_cnp:
        return "adoptive_parent" if record.record_type == "adoption_decree" else "legal_guardian"
    return "parent"


@router.get("/children/registry", response_model=List[RegistryChildResult])
def search_registry(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Return civil registry records where the current user is listed as a parent/guardian."""
    cnp = current_user.cnp
    records = db.query(CivilRegistry).filter(
        CivilRegistry.is_valid.is_(True),
        (CivilRegistry.parent1_cnp == cnp)
        | (CivilRegistry.parent2_cnp == cnp)
        | (CivilRegistry.guardian_cnp == cnp),
    ).all()

    # Gather CNPs of children this user is already a guardian of
    linked_child_ids = [
        link.child_id
        for link in db.query(ChildGuardian).filter(
            ChildGuardian.guardian_id == current_user.id,
            ChildGuardian.is_active.is_(True),
        ).all()
    ]
    linked_cnps = {
        p.cnp
        for p in db.query(ChildProfile).filter(ChildProfile.id.in_(linked_child_ids)).all()
        if p.cnp is not None
    }

    return [
        RegistryChildResult(
            registry_id=r.id,
            child_full_name=r.child_full_name,
            child_date_of_birth=r.child_date_of_birth,
            child_cnp=r.child_cnp,
            record_type=r.record_type,
            document_number=r.document_number,
            issued_by=r.issued_by,
            relationship_type=_registry_relationship(r, cnp),
            already_linked=r.child_cnp in linked_cnps if r.child_cnp else False,
        )
        for r in records
    ]


@router.post("/children/link-from-registry/{registry_id}", response_model=ChildResponse)
def link_child_from_registry(
    registry_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Create (or join) a child profile from a civil registry record — proof is pre-verified."""
    record = db.query(CivilRegistry).filter(
        CivilRegistry.id == registry_id,
        CivilRegistry.is_valid.is_(True),
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Înregistrare registru negăsită")

    cnp = current_user.cnp
    if cnp not in (record.parent1_cnp, record.parent2_cnp, record.guardian_cnp):
        raise HTTPException(status_code=403, detail="Nu ești listat ca tutore în această înregistrare")

    age = _child_age(record.child_date_of_birth)
    if age >= 18:
        raise HTTPException(status_code=400, detail="Copilul a împlinit 18 ani — nu mai este necesară tutela.")

    relationship = _registry_relationship(record, cnp)

    # Reuse existing ChildProfile if same CNP
    child = None
    if record.child_cnp:
        child = db.query(ChildProfile).filter(ChildProfile.cnp == record.child_cnp).first()

    if child:
        already = db.query(ChildGuardian).filter(
            ChildGuardian.child_id == child.id,
            ChildGuardian.guardian_id == current_user.id,
            ChildGuardian.is_active.is_(True),
        ).first()
        if already:
            raise HTTPException(status_code=400, detail="Ești deja tutore al acestui copil")
    else:
        child = ChildProfile(
            full_name=record.child_full_name,
            date_of_birth=record.child_date_of_birth,
            cnp=record.child_cnp,
        )
        db.add(child)
        db.flush()

        # Attach the civil registry document to the child profile
        doc = ChildDocument(
            child_id=child.id,
            doc_type=record.record_type.upper() if record.record_type == "ci" else "CERT_NASTERE"
                if record.record_type == "birth_certificate" else "PROCURA",
            doc_number=record.document_number,
            issued_by=record.issued_by,
            issued_date=record.issued_date,
        )
        db.add(doc)

    link = ChildGuardian(
        child_id=child.id,
        guardian_id=current_user.id,
        relationship_type=relationship,
        proof_type=record.record_type,
        proof_verified=True,
    )
    db.add(link)

    add_audit_entry(
        db,
        action="CHILD_PROFILE_CREATE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={
            "child_name": record.child_full_name,
            "child_dob": str(record.child_date_of_birth),
            "relationship": relationship,
            "source": "civil_registry",
            "registry_id": registry_id,
        },
    )
    db.commit()
    db.refresh(child)
    return _serialize_child(child, link, db)


@router.get("/children", response_model=List[ChildResponse])
def list_children(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    links = db.query(ChildGuardian).filter(
        ChildGuardian.guardian_id == current_user.id,
        ChildGuardian.is_active.is_(True),
    ).all()
    result = []
    for link in links:
        child = db.query(ChildProfile).filter(ChildProfile.id == link.child_id).first()
        if child and not _expire_if_adult(child, db):
            result.append(_serialize_child(child, link, db))
    return result


@router.get("/children/{child_id}", response_model=ChildResponse)
def get_child(
    child_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    child, link = _get_child_as_guardian(child_id, current_user, db)
    return _serialize_child(child, link, db)


@router.post("/children/{child_id}/documents", response_model=ChildDocumentResponse)
def add_child_document(
    child_id: str,
    data: ChildDocumentCreate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    child, _ = _get_child_as_guardian(child_id, current_user, db)
    doc = ChildDocument(
        child_id=child.id,
        doc_type=data.doc_type,
        doc_number=data.doc_number,
        issued_by=data.issued_by,
        issued_date=data.issued_date,
        expires_date=data.expires_date,
        description=data.description,
        photo_base64=data.photo_base64,
    )
    db.add(doc)
    add_audit_entry(
        db,
        action="CHILD_DOCUMENT_ADD",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"child_name": child.full_name, "doc_type": data.doc_type},
    )
    db.commit()
    db.refresh(doc)
    return ChildDocumentResponse(
        id=doc.id,
        child_id=doc.child_id,
        doc_type=doc.doc_type,
        doc_number=doc.doc_number,
        issued_by=doc.issued_by,
        issued_date=doc.issued_date,
        expires_date=doc.expires_date,
        description=doc.description,
        created_at=doc.created_at,
    )


@router.post("/children/{child_id}/guardians", response_model=ChildResponse)
def add_guardian(
    child_id: str,
    data: AddGuardianRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    child, my_link = _get_child_as_guardian(child_id, current_user, db)

    new_guardian = db.query(User).filter(User.email == data.guardian_email).first()
    if not new_guardian:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")
    if new_guardian.id == current_user.id:
        raise HTTPException(status_code=400, detail="Ești deja tutore al acestui copil")

    already = db.query(ChildGuardian).filter(
        ChildGuardian.child_id == child_id,
        ChildGuardian.guardian_id == new_guardian.id,
        ChildGuardian.is_active.is_(True),
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="Persoana este deja tutore al acestui copil")

    proof_verified = False
    if data.proof_image_base64:
        text = _ocr_image(data.proof_image_base64)
        if text:
            parsed = _parse_birth_cert(text, new_guardian.full_name)
            proof_verified = parsed["requester_found"]

    link = ChildGuardian(
        child_id=child_id,
        guardian_id=new_guardian.id,
        relationship_type=data.relationship_type,
        proof_type=data.proof_type,
        proof_verified=proof_verified,
    )
    db.add(link)
    add_audit_entry(
        db,
        action="CHILD_GUARDIAN_ADD",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={
            "child_name": child.full_name,
            "new_guardian": new_guardian.full_name,
            "relationship": data.relationship_type,
        },
    )
    db.commit()
    db.refresh(child)
    return _serialize_child(child, my_link, db)


@router.delete("/children/{child_id}/guardians/me")
def remove_myself_as_guardian(
    child_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    child, link = _get_child_as_guardian(child_id, current_user, db)

    active_guardians = db.query(ChildGuardian).filter(
        ChildGuardian.child_id == child_id,
        ChildGuardian.is_active.is_(True),
    ).count()

    if active_guardians <= 1:
        raise HTTPException(
            status_code=400,
            detail="Ești singurul tutore. Adaugă alt tutore înainte de a te retrage.",
        )

    link.is_active = False
    add_audit_entry(
        db,
        action="CHILD_GUARDIAN_REMOVE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"child_name": child.full_name},
    )
    db.commit()
    return {"message": "Ai fost eliminat ca tutore"}


# ─── Government document search ──────────────────────────────────────────────

@router.get("/children/{child_id}/available-documents", response_model=List[GovDocResult])
def available_documents(
    child_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Return government-registered documents for a child that aren't yet in their profile."""
    child, _ = _get_child_as_guardian(child_id, current_user, db)
    if not child.cnp:
        return []

    gov_docs = db.query(GovernmentDocRegistry).filter(
        GovernmentDocRegistry.holder_cnp == child.cnp,
        GovernmentDocRegistry.is_valid.is_(True),
    ).all()

    existing_numbers = {d.doc_number for d in child.documents if d.doc_number}

    return [
        GovDocResult(
            gov_doc_id=g.id,
            doc_type=g.doc_type,
            doc_number=g.doc_number,
            issued_by=g.issued_by,
            issued_date=g.issued_date,
            expires_date=g.expires_date,
            description=g.description,
            already_linked=g.doc_number in existing_numbers if g.doc_number else False,
        )
        for g in gov_docs
    ]


@router.post("/children/{child_id}/link-document/{gov_doc_id}", response_model=ChildDocumentResponse)
def link_government_document(
    child_id: str,
    gov_doc_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Add a government-registered document to a child's profile."""
    child, _ = _get_child_as_guardian(child_id, current_user, db)

    gov_doc = db.query(GovernmentDocRegistry).filter(
        GovernmentDocRegistry.id == gov_doc_id,
        GovernmentDocRegistry.holder_cnp == (child.cnp or ""),
        GovernmentDocRegistry.is_valid.is_(True),
    ).first()
    if not gov_doc:
        raise HTTPException(status_code=404, detail="Document negăsit în registrul guvernamental")

    if any(d.doc_number == gov_doc.doc_number for d in child.documents if gov_doc.doc_number):
        raise HTTPException(status_code=400, detail="Documentul este deja în profilul copilului")

    doc = ChildDocument(
        child_id=child.id,
        doc_type=gov_doc.doc_type,
        doc_number=gov_doc.doc_number,
        issued_by=gov_doc.issued_by,
        issued_date=gov_doc.issued_date,
        expires_date=gov_doc.expires_date,
        description=gov_doc.description,
    )
    db.add(doc)
    add_audit_entry(
        db,
        action="CHILD_DOCUMENT_ADD",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"child_name": child.full_name, "doc_type": gov_doc.doc_type, "source": "gov_registry"},
    )
    db.commit()
    db.refresh(doc)
    return ChildDocumentResponse(
        id=doc.id, child_id=doc.child_id, doc_type=doc.doc_type, doc_number=doc.doc_number,
        issued_by=doc.issued_by, issued_date=doc.issued_date, expires_date=doc.expires_date,
        description=doc.description, created_at=doc.created_at,
    )


@router.post("/children/{child_id}/request-student-id", response_model=ChildDocumentResponse)
def request_student_id(
    child_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Search government registry for a CARNET_ELEV for this child and link it automatically."""
    child, _ = _get_child_as_guardian(child_id, current_user, db)

    if any(d.doc_type == "CARNET_ELEV" for d in child.documents):
        raise HTTPException(status_code=400, detail="Copilul are deja un carnet de elev înregistrat.")

    if not child.cnp:
        raise HTTPException(status_code=400, detail="CNP-ul copilului nu este disponibil — nu se poate căuta în registru.")

    gov_doc = (
        db.query(GovernmentDocRegistry)
        .filter(
            GovernmentDocRegistry.holder_cnp == child.cnp,
            GovernmentDocRegistry.doc_type == "CARNET_ELEV",
            GovernmentDocRegistry.is_valid.is_(True),
        )
        .first()
    )

    if not gov_doc:
        raise HTTPException(status_code=404, detail="Niciun carnet de elev găsit în registrul guvernamental pentru acest copil.")

    doc = ChildDocument(
        child_id=child.id,
        doc_type="CARNET_ELEV",
        doc_number=gov_doc.doc_number,
        issued_by=gov_doc.issued_by,
        issued_date=gov_doc.issued_date,
        expires_date=gov_doc.expires_date,
        description=gov_doc.description,
    )
    db.add(doc)
    add_audit_entry(
        db,
        action="CHILD_DOCUMENT_ADD",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"child_name": child.full_name, "doc_type": "CARNET_ELEV", "school": gov_doc.issued_by},
    )
    db.commit()
    db.refresh(doc)
    return ChildDocumentResponse(
        id=doc.id, child_id=doc.child_id, doc_type=doc.doc_type, doc_number=doc.doc_number,
        issued_by=doc.issued_by, issued_date=doc.issued_date, expires_date=doc.expires_date,
        description=doc.description, created_at=doc.created_at,
    )


@router.post("/children/{child_id}/transport-card", response_model=ChildDocumentResponse)
def generate_transport_card(
    child_id: str,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """Generate a student transport card. Child must have a linked CARNET_ELEV."""
    child, _ = _get_child_as_guardian(child_id, current_user, db)

    if not any(d.doc_type == "CARNET_ELEV" for d in child.documents):
        raise HTTPException(status_code=400, detail="Copilul trebuie să aibă un carnet de elev activ pentru a genera cardul de transport.")

    if any(d.doc_type == "CARD_TRANSPORT_ELEV" for d in child.documents):
        raise HTTPException(status_code=400, detail="Cardul de transport există deja.")

    today = date.today()
    expiry = date(today.year, 8, 31) if today.month <= 8 else date(today.year + 1, 8, 31)

    import secrets as _secrets
    card_number = f"CTP-{today.year}-{_secrets.token_hex(3).upper()}"

    doc = ChildDocument(
        child_id=child.id,
        doc_type="CARD_TRANSPORT_ELEV",
        doc_number=card_number,
        issued_by="CTP Cluj — Compania de Transport Public",
        issued_date=today,
        expires_date=expiry,
        description=f"Card transport elev — valabil an școlar {today.year}/{expiry.year}",
    )
    db.add(doc)
    add_audit_entry(
        db,
        action="CHILD_DOCUMENT_ADD",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        metadata={"child_name": child.full_name, "doc_type": "CARD_TRANSPORT_ELEV", "card_number": card_number},
    )
    db.commit()
    db.refresh(doc)
    return ChildDocumentResponse(
        id=doc.id, child_id=doc.child_id, doc_type=doc.doc_type, doc_number=doc.doc_number,
        issued_by=doc.issued_by, issued_date=doc.issued_date, expires_date=doc.expires_date,
        description=doc.description, created_at=doc.created_at,
    )
