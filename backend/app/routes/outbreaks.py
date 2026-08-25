"""
KrishiRakshak — Outbreaks Route

Endpoints for retrieving community outbreak alerts and triggering refresh evaluations.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import OutbreakListResponse
from ..services.outbreak import get_active_outbreaks, detect_outbreaks

router = APIRouter(prefix="/api/outbreaks", tags=["Outbreaks"])


@router.get("", response_model=OutbreakListResponse)
def list_active_outbreaks(db: Session = Depends(get_db)):
    """
    Get all active regional disease outbreak alerts.
    """
    alerts = get_active_outbreaks(db)
    return OutbreakListResponse(total=len(alerts), alerts=alerts)


@router.post("/refresh", response_model=OutbreakListResponse)
def refresh_outbreaks(db: Session = Depends(get_db)):
    """
    Manually trigger outbreak detection query across recent scans.
    """
    alerts = detect_outbreaks(db)
    return OutbreakListResponse(total=len(alerts), alerts=alerts)
