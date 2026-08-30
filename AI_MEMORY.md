# KrishiRakshak: AI Context & Memory

> **Note to AI Assistants:** Read this file to understand the project context, technical decisions, and current state before making modifications.

## Project Overview
**KrishiRakshak (Farmers Disease Diagnostic and Reporting Portal)** is an AI-based mobile platform designed to diagnose crop diseases from leaf images and track regional disease outbreaks.

### Key Differentiator
Unlike standalone diagnostic apps (e.g., Plantix), this project aggregates diagnoses using geohashing to detect and surface **regional disease outbreaks** (e.g., "5 farmers within 5km reported Late Blight this week").

## Technology Stack
- **Mobile App**: Flutter (Camera capture, Diagnosis UI, History) - *Pending implementation*
- **Backend API**: FastAPI, SQLAlchemy (PostgreSQL in prod, SQLite for local dev)
- **ML Service**: PyTorch (MobileNetV2 Transfer Learning), FastAPI (for serving)
- **Dashboard**: Vanilla HTML/JS, Leaflet.js, Chart.js
- **Environment**: Python 3.13, Windows

## Architecture & Design Decisions
1. **Microservices Pattern**: ML inference (`ml/serving`) and Backend logic (`backend/app`) run as separate FastAPI services.
2. **Database Fallback**: The backend defaults to PostgreSQL via Docker, but has been configured to seamlessly use a local SQLite file (`krishirakshak.db`) for lightweight local testing.
3. **Geohashing Fallback**: `python-geohash` failed to compile on Windows (missing Rust/C++). We removed it from `requirements.txt` and implemented a pure-Python fallback in `backend/app/services/geo.py`.
4. **ML Demo Mode**: The ML service (`app.py`) is programmed to start gracefully in "Demo Mode" (untrained weights) if `best_model.pt` is missing. This allows the backend and dashboard to be tested before the lengthy dataset training process is complete.
5. **ML Out-Of-Distribution (OOD) Fix**: The ML dataset has class imbalance and closed-set limitations (e.g. Grape falsely predicted as Strawberry). We chose **Confidence Thresholding (e.g. 65%)** inside `serving/app.py` instead of retraining to reject unknown images.
6. **Flutter Android Build Environment**: The user's system runs Java 25 (OpenJDK 25). To support this, Flutter uses **Gradle 9.3.1** and **AGP 9.1.0**. We also pinned the Android NDK to version `30.0.16138531` to prevent `sdkmanager.bat` crash errors on Windows.

## Mobile UX & Product Requirements
1. **Mobile-First & Simple**: Large touch targets, minimal typing, visual UI. 
2. **Language Selection First**: First launch MUST show a language matrix (తెలుగు, हिन्दी, English, etc.) in native scripts. This language choice persists across the entire app.
3. **Authentication**: After language selection -> Phone Number -> OTP.
4. **Three Main Tabs**:
   - **Diagnose (Check My Crop)**: Primary action, simple camera flow.
   - **History**: Past predictions.
   - **Nearby Alerts (Area Alerts)**: View local outbreaks on a map.
5. **No AI Gaslighting**: If an image is unsupported, it must be rejected rather than confidently giving a wrong disease. Disease reporting is 1-click confirmation following a prediction.

## Current Project State (What has been built)
- [x] Full directory scaffolding
- [x] Backend database models (UUID cross-compatible with Postgres/SQLite)
- [x] Backend REST API endpoints (`/scans`, `/outbreaks`, `/stats`)
- [x] Outbreak detection logic (`backend/app/services/outbreak.py`)
- [x] ML Training on GPU + ONNX export completed (`ml/models/best_model.pt`)
- [x] ML Serving API (`ml/serving/app.py`) live with trained weights
- [x] Interactive Web Dashboard (`dashboard/index.html` with Leaflet auto-zoom)
- [x] `seed_data.py` script to generate fake outbreak clusters for demo purposes.

## Next Steps
1. **ML OOD Update**: Implement the Confidence Threshold check inside `/predict`.
2. **Mobile App**: Begin building the Flutter UI focusing exactly on the requested UX requirements (Language screen -> OTP -> 3 Tabs).
3. **Integration Testing**: End-to-end test from mobile photo capture to dashboard alert generation.
