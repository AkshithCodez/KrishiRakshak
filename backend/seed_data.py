"""
KrishiRakshak — Seed Data Generator

Populates PostgreSQL with realistic scan reports, including simulated regional
outbreak clusters to demonstrate the community alert system on Demo Day.

Clusters created:
1. Region A (Anantapur, AP): 5 distinct farmers reporting Tomato Late Blight in last 3 days -> Outbreak!
2. Region B (Nashik, MH): 4 distinct farmers reporting Grape Black Rot in last 5 days -> Outbreak!
3. Region C (Guntur, AP): 3 distinct farmers reporting Pepper Bacterial Spot -> Outbreak!
4. Dispersed baseline scans across crops (Potato, Corn, Apple) with normal healthy/isolated reports.

Usage:
    python seed_data.py
"""

import os
import sys
import random
import uuid
from datetime import datetime, timedelta, timezone

# Ensure backend directory is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.db import SessionLocal, Base, engine
from app.models import ScanReport
from app.services.geo import compute_geohash
from app.services.outbreak import detect_outbreaks

# Simulated demo clusters
OUTBREAK_CLUSTERS = [
    {
        "crop": "Tomato",
        "disease": "Late Blight",
        "treatment": "Apply systemic fungicides (metalaxyl + mancozeb). Destroy infected plants immediately.",
        "base_lat": 14.6819,
        "base_lng": 77.6006,  # Anantapur, AP
        "count": 6,
        "days_ago_range": (0, 3),
        "confidence_range": (0.88, 0.98),
    },
    {
        "crop": "Grape",
        "disease": "Black Rot",
        "treatment": "Apply fungicides (myclobutanil, mancozeb). Remove mummified berries from vineyard.",
        "base_lat": 19.9975,
        "base_lng": 73.7898,  # Nashik, MH
        "count": 5,
        "days_ago_range": (1, 5),
        "confidence_range": (0.90, 0.97),
    },
    {
        "crop": "Bell Pepper",
        "disease": "Bacterial Spot",
        "treatment": "Use copper-based sprays mixed with mancozeb. Avoid working in wet foliage.",
        "base_lat": 16.3067,
        "base_lng": 80.4365,  # Guntur, AP
        "count": 4,
        "days_ago_range": (2, 6),
        "confidence_range": (0.85, 0.94),
    },
]

# Baseline random scans
SPORADIC_SCANS = [
    ("Corn", "Common Rust", "Plant rust-resistant hybrids. Apply foliar fungicides if early.", 17.3850, 78.4867),
    ("Potato", "Early Blight", "Apply chlorothalonil or mancozeb at first sign of lesions.", 15.8281, 78.0373),
    ("Tomato", "Healthy", "No disease detected. Continue standard monitoring and irrigation.", 14.7000, 77.6200),
    ("Apple", "Apple Scab", "Apply captan at green-tip stage. Prune trees for airflow.", 32.2432, 77.1892),
    ("Peach", "Bacterial Spot", "Apply copper bactericides during dormancy. Maintain tree vigor.", 31.1048, 77.1734),
    ("Corn", "Northern Leaf Blight", "Use resistant hybrids. Apply foliar fungicides.", 16.5062, 80.6480),
]


def seed():
    print("[Seed] Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing demo records
    db.query(ScanReport).delete()
    db.commit()

    total_added = 0
    now = datetime.now(timezone.utc)

    # 1. Add cluster outbreak records
    for cluster in OUTBREAK_CLUSTERS:
        for i in range(cluster["count"]):
            # Small jitter within ~2-3km radius
            lat = cluster["base_lat"] + random.uniform(-0.02, 0.02)
            lng = cluster["base_lng"] + random.uniform(-0.02, 0.02)
            days_ago = random.uniform(*cluster["days_ago_range"])
            created_at = now - timedelta(days=days_ago, minutes=random.randint(0, 1440))
            conf = round(random.uniform(*cluster["confidence_range"]), 3)
            geohash_val = compute_geohash(lat, lng, precision=12)

            device_id = f"farmer_dev_{cluster['crop'][:3].lower()}_{i+1:02d}"

            scan = ScanReport(
                id=uuid.uuid4(),
                device_id=device_id,
                crop=cluster["crop"],
                disease=cluster["disease"],
                confidence=conf,
                latitude=lat,
                longitude=lng,
                geohash=geohash_val,
                treatment=cluster["treatment"],
                created_at=created_at,
            )
            db.add(scan)
            total_added += 1

    # 2. Add sporadic scans
    for item in SPORADIC_SCANS:
        crop, disease, treatment, lat, lng = item
        geohash_val = compute_geohash(lat, lng, precision=12)
        created_at = now - timedelta(days=random.uniform(0.5, 6.0))
        scan = ScanReport(
            id=uuid.uuid4(),
            device_id=f"farmer_sporadic_{random.randint(100, 999)}",
            crop=crop,
            disease=disease,
            confidence=round(random.uniform(0.80, 0.96), 3),
            latitude=lat + random.uniform(-0.05, 0.05),
            longitude=lng + random.uniform(-0.05, 0.05),
            geohash=geohash_val,
            treatment=treatment,
            created_at=created_at,
        )
        db.add(scan)
        total_added += 1

    db.commit()
    print(f"[Seed] Added {total_added} simulated scan reports.")

    # 3. Trigger outbreak detection to populate outbreak_alerts
    alerts = detect_outbreaks(db)
    print(f"[Seed] Outbreak detection executed. {len(alerts)} active regional outbreaks detected:")
    for a in alerts:
        print(f"  🚨 Outbreak: {a.crop} - {a.disease} ({a.case_count} reports) in cell '{a.geohash}'")

    db.close()
    print("[Seed] Complete!")


if __name__ == "__main__":
    seed()
