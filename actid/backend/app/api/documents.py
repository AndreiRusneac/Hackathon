import json
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import DelegationGrant, Document, User
from ..schemas.schemas import DocumentCreate, DocumentResponse, RenewalRequestCreate, RenewalRequestResponse

router = APIRouter(prefix="/documents", tags=["documents"])


def _doc_status(expires_date: Optional[date]) -> tuple[str, Optional[int]]:
    if expires_date is None:
        return "valid", None
    today = date.today()
    delta = (expires_date - today).days
    if delta < 0:
        return "expirat", delta
    if delta <= 30:
        return "expiră_curând", delta
    return "valid", delta


def _serialize_doc(doc: Document) -> DocumentResponse:
    status, days = _doc_status(doc.expires_date)
    return DocumentResponse(
        id=doc.id,
        owner_id=doc.owner_id,
        doc_type=doc.doc_type,
        doc_number=doc.doc_number,
        issued_by=doc.issued_by,
        issued_date=doc.issued_date,
        expires_date=doc.expires_date,
        is_verified=doc.is_verified,
        description=doc.description,
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
                DelegationGrant.is_active == True,
            )
            .first()
        )
        if not grant:
            raise HTTPException(status_code=403, detail="Acces interzis")

    add_audit_entry(
        db,
        action="RENEWAL_REQUEST",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        target_document_id=doc.id,
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
            DelegationGrant.is_active == True,
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
                DelegationGrant.is_active == True,
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

    doc = Document(
        owner_id=current_user.id,
        doc_type=data.doc_type,
        doc_number=data.doc_number,
        issued_by=data.issued_by,
        issued_date=data.issued_date,
        expires_date=data.expires_date,
        description=data.description,
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
