"""
KrishiRakshak — Outbreak Detection Service

Implements community outbreak aggregation logic:
Identifies clusters where >= N distinct devices report the same disease
within the same geohash prefix cell (~5km) across a rolling time window (e.g., 7 days).
"""

from datetime import datetime, timedelta, timezone
from typing import List
from uuid import uuid4

from sqlalchemy import func, and_, select, delete
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ScanReport, OutbreakAlert

settings = get_settings()


def detect_outbreaks(
    db: Session,
    window_days: int = None,
    min_reports: int = None,
    geohash_precision: int = None,
) -> List[OutbreakAlert]:
    """
    Scans recent reports, detects regional outbreak clusters, and updates outbreak_alerts table.
    
    Logic:
    1. Filter out 'healthy' diagnoses.
    2. Filter scans from the last `window_days` (default 7).
    3. Group by (disease, crop, LEFT(geohash, precision)).
    4. Having COUNT(DISTINCT device_id) >= min_reports (default 3).
    5. Refresh `outbreak_alerts` table with active alerts.
    """
    if window_days is None:
        window_days = settings.OUTBREAK_TIME_WINDOW_DAYS
    if min_reports is None:
        min_reports = settings.OUTBREAK_MIN_REPORTS
    if geohash_precision is None:
        geohash_precision = settings.OUTBREAK_GEOHASH_PRECISION

    since_time = datetime.now(timezone.utc) - timedelta(days=window_days)
    geo_cell_expr = func.substr(ScanReport.geohash, 1, geohash_precision).label("region_cell")

    # SQL aggregation query
    query = (
        db.query(
            ScanReport.disease.label("disease"),
            ScanReport.crop.label("crop"),
            geo_cell_expr,
            func.count(func.distinct(ScanReport.device_id)).label("unique_reporters"),
            func.avg(ScanReport.latitude).label("center_lat"),
            func.avg(ScanReport.longitude).label("center_lng"),
            func.min(ScanReport.created_at).label("first_reported"),
            func.max(ScanReport.created_at).label("last_reported"),
        )
        .filter(
            and_(
                ScanReport.created_at >= since_time,
                func.lower(ScanReport.disease) != "healthy",
                ~func.lower(ScanReport.disease).contains("healthy")
            )
        )
        .group_by(ScanReport.disease, ScanReport.crop, geo_cell_expr)
        .having(func.count(func.distinct(ScanReport.device_id)) >= min_reports)
    )

    clusters = query.all()

    # Clear previous active alerts or mark inactive
    db.query(OutbreakAlert).update({OutbreakAlert.is_active: False})

    detected_alerts: List[OutbreakAlert] = []
    now_utc = datetime.now(timezone.utc)

    for cluster in clusters:
        alert = OutbreakAlert(
            id=uuid4(),
            disease=cluster.disease,
            crop=cluster.crop,
            geohash=cluster.region_cell,
            case_count=cluster.unique_reporters,
            center_lat=float(cluster.center_lat),
            center_lng=float(cluster.center_lng),
            first_reported=cluster.first_reported,
            last_reported=cluster.last_reported,
            created_at=now_utc,
            is_active=True,
        )
        db.add(alert)
        detected_alerts.append(alert)

    db.commit()
    return detected_alerts


def get_active_outbreaks(db: Session) -> List[OutbreakAlert]:
    """Retrieve all currently active outbreak alerts."""
    return (
        db.query(OutbreakAlert)
        .filter(OutbreakAlert.is_active == True)
        .order_by(OutbreakAlert.case_count.desc(), OutbreakAlert.last_reported.desc())
        .all()
    )
