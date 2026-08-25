"""
KrishiRakshak — SQLAlchemy ORM Models

Database table definitions for scan_reports and outbreak_alerts.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Float, Text, Boolean, Integer,
    DateTime, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from .db import Base


class ScanReport(Base):
    """
    A single disease scan submitted by a farmer's device.
    
    Each record represents one photograph → diagnosis event,
    tagged with geolocation and timestamp for outbreak analysis.
    """
    __tablename__ = "scan_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(64), nullable=False, index=True)
    crop = Column(String(32), nullable=False)
    disease = Column(String(64), nullable=False)
    confidence = Column(Float, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geohash = Column(String(12), nullable=False, index=True)
    image_url = Column(Text, nullable=True)
    treatment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    __table_args__ = (
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_confidence_range"),
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_latitude_range"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_longitude_range"),
        Index("idx_scans_outbreak", "geohash", "disease", "created_at"),
        Index("idx_scans_crop_disease", "crop", "disease", "created_at"),
    )

    def __repr__(self):
        return f"<ScanReport {self.crop}/{self.disease} @ {self.geohash}>"


class OutbreakAlert(Base):
    """
    A computed outbreak alert when multiple farmers report the same
    disease within the same geohash cell in a rolling time window.
    
    These are generated/refreshed by the outbreak detection service,
    not directly by user input.
    """
    __tablename__ = "outbreak_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    disease = Column(String(64), nullable=False)
    crop = Column(String(32), nullable=False)
    geohash = Column(String(12), nullable=False, index=True)
    case_count = Column(Integer, nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    first_reported = Column(DateTime(timezone=True), nullable=False)
    last_reported = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_outbreak_active", "is_active", "created_at"),
    )

    def __repr__(self):
        return f"<OutbreakAlert {self.crop}/{self.disease} x{self.case_count} @ {self.geohash}>"
