import json
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api.auth import require_role
from ..database import get_db
from ..models.models import Document, ShareScanLog, ShareToken, User
from ..schemas.schemas import FunctionarStatsResponse, RecentScanResponse

router = APIRouter(prefix="/functionar", tags=["funcționar"])


@router.get("/recent-scans", response_model=List[RecentScanResponse])
def recent_scans(
    current_user: User = Depends(require_role("funcționar")),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(ShareScanLog)
        .filter(ShareScanLog.scanned_by == current_user.id)
        .order_by(ShareScanLog.scanned_at.desc())
        .limit(20)
        .all()
    )

    result = []
    for log in logs:
        token = db.query(ShareToken).filter(ShareToken.id == log.token_id).first()
        if not token:
            continue

        owner = db.query(User).filter(User.id == token.creator_id).first()
        doc_ids = json.loads(token.document_ids)
        docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()

        result.append(RecentScanResponse(
            scan_id=log.id,
            token=token.token,
            scanned_at=log.scanned_at,
            owner_name=owner.full_name if owner else "Necunoscut",
            doc_types=[d.doc_type for d in docs],
            context=token.context,
        ))

    return result


@router.get("/stats", response_model=FunctionarStatsResponse)
def functionar_stats(
    current_user: User = Depends(require_role("funcționar")),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    total_today = (
        db.query(ShareScanLog)
        .filter(
            ShareScanLog.scanned_by == current_user.id,
            ShareScanLog.scanned_at >= today_start,
        )
        .count()
    )
    total_week = (
        db.query(ShareScanLog)
        .filter(
            ShareScanLog.scanned_by == current_user.id,
            ShareScanLog.scanned_at >= week_start,
        )
        .count()
    )

    all_logs = (
        db.query(ShareScanLog)
        .filter(ShareScanLog.scanned_by == current_user.id)
        .all()
    )
    token_ids = [log.token_id for log in all_logs]
    unique_citizens = 0
    if token_ids:
        unique_citizens = (
            db.query(ShareToken.creator_id)
            .filter(ShareToken.id.in_(token_ids))
            .distinct()
            .count()
        )

    return FunctionarStatsResponse(
        total_scans_today=total_today,
        total_scans_week=total_week,
        unique_citizens=unique_citizens,
    )
