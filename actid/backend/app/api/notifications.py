import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api.auth import get_current_user_dep
from ..api.documents import _doc_status
from ..database import get_db
from ..models.models import DelegationGrant, Document, User
from ..schemas.schemas import NotificationItem

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _severity(status: str, days: int | None) -> str:
    if status == "expirat":
        return "expired"
    if days is not None and days <= 7:
        return "urgent"
    return "warning"


@router.get("/", response_model=List[NotificationItem])
def get_notifications(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    notifications: list[NotificationItem] = []

    own_docs = db.query(Document).filter(Document.owner_id == current_user.id).all()
    for doc in own_docs:
        status, days = _doc_status(doc.expires_date)
        if status == "valid":
            continue
        notifications.append(NotificationItem(
            doc_id=doc.id,
            doc_type=doc.doc_type,
            doc_title=doc.description or doc.doc_type,
            days_until_expiry=days,
            severity=_severity(status, days),
            is_delegated=False,
        ))

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

    for grant in grants:
        delegator = db.query(User).filter(User.id == grant.delegator_id).first()
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
            if status == "valid":
                continue
            notifications.append(NotificationItem(
                doc_id=doc.id,
                doc_type=doc.doc_type,
                doc_title=doc.description or doc.doc_type,
                days_until_expiry=days,
                severity=_severity(status, days),
                is_delegated=True,
                delegated_from_name=delegator.full_name if delegator else None,
            ))

    order = {"expired": 0, "urgent": 1, "warning": 2}
    notifications.sort(key=lambda n: (order.get(n.severity, 3), n.days_until_expiry or 0))

    return notifications
