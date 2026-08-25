"""
KrishiRakshak — Pydantic Schemas

Request/response schemas for API validation and serialization.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ──────────────────────────────────────────────
# Scan Report Schemas
# ──────────────────────────────────────────────

class ScanCreate(BaseModel):
    """Request body for creating a new scan report."""
    device_id: str = Field(..., min_length=1, max_length=64)
    crop: str = Field(..., min_length=1, max_length=32)
    disease: str = Field(..., min_length=1, max_length=64)
    confidence: float = Field(..., ge=0.0, le=1.0)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    image_url: Optional[str] = None
    treatment: str = Field(..., min_length=1)

    @field_validator("crop", "disease")
    @classmethod
    def lowercase_fields(cls, v: str) -> str:
        return v.strip()


class ScanResponse(BaseModel):
    """Response body for a single scan report."""
    id: UUID
    device_id: str
    crop: str
    disease: str
    confidence: float
    latitude: float
    longitude: float
    geohash: str
    image_url: Optional[str]
    treatment: str
    created_at: datetime

    class Config:
        from_attributes = True


class ScanListResponse(BaseModel):
    """Paginated list of scan reports."""
    total: int
    scans: list[ScanResponse]


# ──────────────────────────────────────────────
# Outbreak Alert Schemas
# ──────────────────────────────────────────────

class OutbreakResponse(BaseModel):
    """Response body for a single outbreak alert."""
    id: UUID
    disease: str
    crop: str
    geohash: str
    case_count: int
    center_lat: float
    center_lng: float
    first_reported: datetime
    last_reported: datetime
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class OutbreakListResponse(BaseModel):
    """List of outbreak alerts."""
    total: int
    alerts: list[OutbreakResponse]


# ──────────────────────────────────────────────
# Stats Schemas
# ──────────────────────────────────────────────

class DiseaseFrequency(BaseModel):
    """Disease occurrence count for dashboard stats."""
    crop: str
    disease: str
    count: int


class StatsResponse(BaseModel):
    """Aggregate statistics for the dashboard."""
    total_scans: int
    total_devices: int
    total_outbreaks_active: int
    disease_frequency: list[DiseaseFrequency]
    scans_last_7_days: int
    scans_last_30_days: int
