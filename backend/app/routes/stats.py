"""
KrishiRakshak — Stats Route

Aggregated statistics for the web dashboard (scan counts, top diseases, active alerts).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ScanReport, OutbreakAlert
from ..schemas import StatsResponse, DiseaseFrequency

router = APIRouter(prefix="/api/stats", tags=["Stats"])


@router.get("", response_model=StatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get summary statistics for dashboard charts and metrics panels.
    """
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    total_scans = db.query(func.count(ScanReport.id)).scalar() or 0
    total_devices = db.query(func.count(func.distinct(ScanReport.device_id))).scalar() or 0
    active_outbreaks = db.query(func.count(OutbreakAlert.id)).filter(OutbreakAlert.is_active == True).scalar() or 0

    scans_7d = (
        db.query(func.count(ScanReport.id))
        .filter(ScanReport.created_at >= seven_days_ago)
        .scalar()
        or 0
    )

    scans_30d = (
        db.query(func.count(ScanReport.id))
        .filter(ScanReport.created_at >= thirty_days_ago)
        .scalar()
        or 0
    )

    # Disease frequency counts
    freq_query = (
        db.query(
            ScanReport.crop,
            ScanReport.disease,
            func.count(ScanReport.id).label("count")
        )
        .filter(
            func.lower(ScanReport.disease) != "healthy",
            ~func.lower(ScanReport.disease).contains("healthy")
        )
        .group_by(ScanReport.crop, ScanReport.disease)
        .order_by(func.count(ScanReport.id).desc())
        .limit(10)
        .all()
    )

    disease_freq = [
        DiseaseFrequency(crop=row.crop, disease=row.disease, count=row.count)
        for row in freq_query
    ]

    return StatsResponse(
        total_scans=total_scans,
        total_devices=total_devices,
        total_outbreaks_active=active_outbreaks,
        disease_frequency=disease_freq,
        scans_last_7_days=scans_7d,
        scans_last_30_days=scans_30d,
    )
