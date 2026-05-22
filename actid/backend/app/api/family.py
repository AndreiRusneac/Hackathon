import json
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import DelegationGrant, User
from ..schemas.schemas import DelegationCreate, DelegationResponse

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
            DelegationGrant.is_active == True,
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
    grants = (
        db.query(DelegationGrant)
        .filter(
            DelegationGrant.delegate_id == current_user.id,
            DelegationGrant.is_active == True,
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
            DelegationGrant.is_active == True,
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
