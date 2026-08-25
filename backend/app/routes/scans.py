"""
KrishiRakshak — Scans Route

Endpoints for submitting, retrieving, and filtering crop leaf scan records.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ScanReport
from ..schemas import ScanCreate, ScanResponse, ScanListResponse
from ..services.geo import compute_geohash
from ..services.outbreak import detect_outbreaks

router = APIRouter(prefix="/api/scans", tags=["Scans"])


@router.post("", response_model=ScanResponse, status_code=201)
def create_scan(scan_in: ScanCreate, db: Session = Depends(get_db)):
    """
    Log a new crop disease diagnosis result with geolocation.
    Automatically calculates geohash and checks for outbreak cluster trigger.
    """
    geohash_val = compute_geohash(scan_in.latitude, scan_in.longitude, precision=12)

    db_scan = ScanReport(
        id=uuid4(),
        device_id=scan_in.device_id,
        crop=scan_in.crop,
        disease=scan_in.disease,
        confidence=scan_in.confidence,
        latitude=scan_in.latitude,
        longitude=scan_in.longitude,
        geohash=geohash_val,
        image_url=scan_in.image_url,
        treatment=scan_in.treatment,
        created_at=datetime.now(timezone.utc),
    )

    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)

    # Trigger lightweight outbreak cluster refresh
    try:
        detect_outbreaks(db)
    except Exception:
        pass  # Non-blocking for scan logging

    return db_scan


@router.get("", response_model=ScanListResponse)
def list_scans(
    crop: Optional[str] = None,
    disease: Optional[str] = None,
    device_id: Optional[str] = None,
    geohash_prefix: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """
    List scan reports with optional filtering by crop, disease, device, or geohash prefix.
    """
    query = db.query(ScanReport)

    if crop:
        query = query.filter(ScanReport.crop.ilike(f"%{crop}%"))
    if disease:
        query = query.filter(ScanReport.disease.ilike(f"%{disease}%"))
    if device_id:
        query = query.filter(ScanReport.device_id == device_id)
    if geohash_prefix:
        query = query.filter(ScanReport.geohash.startswith(geohash_prefix))

    total = query.count()
    scans = query.order_by(desc(ScanReport.created_at)).offset(offset).limit(limit).all()

    return ScanListResponse(total=total, scans=scans)


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: UUID, db: Session = Depends(get_db)):
    """Retrieve details for a single scan report."""
    scan = db.query(ScanReport).filter(ScanReport.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan report not found")
    return scan
