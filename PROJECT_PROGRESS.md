# KrishiRakshak — Project Progress & Development State Log

> **Purpose:** This document provides a comprehensive, chronological log of all architectural decisions, implementations, bug resolutions, and the exact operational state of the **KrishiRakshak** project. Any AI assistant or developer picking up this repository should read this file to gain full situational context.

---

## 1. Project Identity & Scope

- **Project Title:** KrishiRakshak (Farmers Disease Diagnostic and Reporting Portal)
- **Primary Objective:** Build an AI-driven agricultural platform where farmers capture leaf photos to diagnose crop diseases, while the backend aggregates geo-tagged diagnoses to detect and surface regional disease outbreak clusters in real-time.
- **Core Value Differentiator:** While existing apps (e.g., Plantix, Agrio) provide isolated single-user diagnoses, KrishiRakshak detects community-level outbreaks (e.g., *"5 farmers within 5km reported Tomato Late Blight in the last 7 days"*) and alerts neighboring farmers and agricultural officers.
- **Dataset & Classification Scope:** All **14 crops** and all **38 disease/healthy classes** from the full **PlantVillage dataset**.

---

## 2. Completed Milestones & Architectural Implementation

### Milestone 1: System Scaffolding & Architecture
- Structured the repository into modular sub-systems:
  - `ml/`: PyTorch training pipelines, dataset loaders, preprocessing, model definitions, ONNX export tools, and FastAPI inference server.
  - `backend/`: FastAPI REST API, SQLAlchemy ORM, outbreak clustering engine, JWT authentication, and seeding scripts.
  - `mobile/`: Flutter mobile application structure (camera capture, diagnostic result views, geolocation tagging, scan history).
  - `dashboard/`: Agricultural officer dashboard (Leaflet.js interactive map, Chart.js analytics, real-time outbreak warning feed).
  - `docs/`: System architecture specs and API documentation.

### Milestone 2: Environment Configuration & Windows Compatibility
- **Virtual Environment:** Initialized with Python 3.13 (`venv/`).
- **Geohash Dependency Resolution:** 
  - `python-geohash` failed on Windows due to missing C/Rust build tools.
  - *Resolution:* Removed `python-geohash` from `requirements.txt` and implemented an in-house, zero-dependency pure-Python geohashing module (`backend/app/services/geo.py`) with full base32 encode/decode support.

### Milestone 3: Database Engine & Hybrid Storage
- Configured SQLAlchemy to support dual execution modes:
  - **Production:** PostgreSQL container with connection pooling.
  - **Local/Development:** Standalone SQLite (`krishirakshak.db`) without Docker dependencies.
- Updated database models (`backend/app/models.py`) to use SQLAlchemy 2.0 generic `Uuid(as_uuid=True)` for seamless compatibility across both SQLite and PostgreSQL.
- Handled SQLite thread-safety (`check_same_thread: False`) and dynamic connection pooling settings in `backend/app/db.py`.

### Milestone 4: Spatial Outbreak Detection Engine
- Implemented core outbreak clustering algorithm in `backend/app/services/outbreak.py`:
  - Temporal sliding window (default: 7 days).
  - Spatial grouping by Geohash precision prefix (default: precision 5, representing a ~4.9 km × 4.9 km cell).
  - Outbreak threshold: Minimum of 3 distinct device IDs reporting the same non-healthy disease in the same spatial cell.
  - Automatic centroid calculation (average latitude/longitude) and case count aggregation.

### Milestone 5: ML Inference Server & Graceful Fallback
- Created FastAPI model serving application (`ml/serving/app.py`):
  - Model architecture: MobileNetV2 with custom classification head.
  - Image preprocessing: Standard 224x224 RGB normalization.
  - Treatment Knowledge Base: Integrated `treatments.json` mapping all 38 classes to chemical/organic recommendations.
  - **Startup Graceful Fallback:** If `best_model.pt` has not yet been trained, the server initializes in **Demo Mode** using an untrained backbone and the 38 class labels from `treatments.json`. This enables API testing and backend integration before running hours of model training.

### Milestone 6: Officer Web Dashboard
- Created zero-build web dashboard (`dashboard/index.html`, `dashboard/app.css`, `dashboard/app.js`):
  - Dark-mode responsive theme tailored for agricultural telemetry.
  - Interactive Leaflet.js map with CartoDB dark basemap.
  - Visual distinction: Green markers for healthy scans, Amber markers for disease detections, Red warning indicators for outbreak clusters.
  - Dynamic map auto-fit: Automatically zooms and centers India's agricultural belt where reports exist.
  - Protocol agnostic: Supports direct browser opening via `file://` or HTTP localhost.

### Milestone 7: Seed Data & Live Verification
- Created `backend/seed_data.py`:
  - Simulates 21 realistic farmer scan reports across Andhra Pradesh (Anantapur, Guntur) and Maharashtra (Nashik).
  - Successfully triggers 3 realistic regional outbreak clusters:
    1. Tomato — Late Blight (Anantapur, AP)
    2. Grape — Black Rot (Nashik, MH)
    3. Tomato — Late Blight cluster (Secondary zone)
- Verified backend endpoints live:
  - `GET /api/stats` -> Returns total scans, active outbreak counts, and top disease frequencies.
  - `GET /api/outbreaks` -> Returns active geo-clustered alerts.
  - `GET /api/scans?limit=50` -> Returns recent scan records with GPS coordinates.

---

## 3. Key File Map & Responsibilities

| File Path | Description |
| :--- | :--- |
| `backend/app/main.py` | FastAPI backend entry point, CORS middleware, route registration. |
| `backend/app/db.py` | Database engine session factory supporting both SQLite and Postgres. |
| `backend/app/models.py` | SQLAlchemy ORM models (`ScanReport`, `OutbreakAlert`). |
| `backend/app/routes/` | API routes: `scans.py`, `outbreaks.py`, `stats.py`, `auth.py`. |
| `backend/app/services/outbreak.py` | Core mathematical outbreak clustering & spatial grouping logic. |
| `backend/app/services/geo.py` | Pure-Python Geohash encoder/decoder and distance calculator. |
| `backend/seed_data.py` | Demo data generator for populating database and verifying outbreaks. |
| `ml/src/dataset.py` | PyTorch Dataset loader with image augmentations for PlantVillage. |
| `ml/src/model.py` | MobileNetV2 transfer learning model definition. |
| `ml/src/train.py` | PyTorch training script with validation, early stopping, and metric logging. |
| `ml/serving/app.py` | ML FastAPI server with `/predict` and `/health` endpoints + demo fallback. |
| `ml/serving/treatments.json` | Comprehensive treatments dictionary for all 38 PlantVillage classes. |
| `dashboard/index.html` | Officer portal UI with metrics, Leaflet map, chart, and alert feed. |
| `dashboard/app.js` | Dashboard frontend client calling backend REST APIs. |
| `AI_MEMORY.md` | Condensed AI context memory for subsequent agent sessions. |
| `README.md` | User guide for activating virtual environment and running services. |

---

## 4. Current Operational State

1. **Backend Server:** Fully functional on `http://localhost:8000`.
2. **ML Inference Server:** Fully functional on `http://localhost:8001` (currently in Demo Mode with 38 classes).
3. **Database:** Fully populated with demo data in `krishirakshak.db`.
4. **Dashboard:** Fully functional when opening `dashboard/index.html` in any browser.
5. **Git Repository:** Synced and up to date with `main` branch at `https://github.com/AkshithCodez/KrishiRakshak.git`.

---

## 5. Upcoming Roadmap & Next Steps

### Step 1: Model Training on Full PlantVillage Dataset
- Download the full 38-class PlantVillage dataset (~54,000 images across 14 crops).
- Place images in `ml/data/plantvillage/`.
- Run `python ml/src/train.py --epochs 15 --batch-size 32 --lr 0.0003`.
- Model will save checkpoint to `ml/models/best_model.pt` and export `ml/models/model.onnx`.
- ML serving app will automatically detect and load the trained model weights.

### Step 2: Flutter Mobile App Development
- Implement Flutter UI in `mobile/`:
  - Camera leaf capture screen with real-time bounding guides.
  - Diagnosis result screen displaying disease name, confidence meter, and treatment recommendations.
  - Outbreak radar / proximity alert screen showing nearby disease outbreaks.
  - Offline-safe scan history cache.
- Integrate Flutter HTTP client with Backend API endpoints.

### Step 3: End-to-End Integration & Demo Prep
- Connect Mobile App -> ML Inference -> Backend Logging -> Dashboard Map Update.
- Test complete lifecycle: Take a photo on mobile -> Receive AI diagnosis -> See pin appear live on dashboard map.
