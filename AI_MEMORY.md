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
- [x] Backend REST API endpoints (`/scans`, `/outbreaks`, `/stats`, `/auth`)
- [x] Outbreak detection logic (`backend/app/services/outbreak.py`)
- [x] ML Training on GPU + ONNX export completed (`ml/models/best_model.pt`)
- [x] ML Serving API (`ml/serving/app.py`) live with trained weights
- [x] Crop-guided logit masking, renormalization, and OOD confidence thresholding
- [x] Interactive Web Dashboard (`dashboard/index.html` with Leaflet auto-zoom)
- [x] `seed_data.py` script to generate fake outbreak clusters for demo purposes
- [x] Mobile UX Overhaul:
  - [x] 7-language native-script matrix on first open (`తెలుగు`, `हिन्दी`, `English`, `ಕನ್ನಡ`, `தமிழ்`, `मराठी`, `বাংলা`) with persistence & in-app switcher
  - [x] Low-friction Phone + OTP auth with Demo OTP (1234)
  - [x] Tab 1: "Check My Crop" diagnostic flow with horizontal crop selector
  - [x] Tab 2: "History" with phone association & dates
  - [x] Tab 3: "Nearby Alerts" regional outbreak monitoring with ~5km cluster indicators
  - [x] Initial AI Classification advisory disclaimer & 1-click area disease reporting confirmation
  - [x] 0 analyzer issues (`flutter analyze` clean)

## Next Steps
1. **Live Verification**: Run mobile client alongside `backend` (port 8000) and `ml.serving` (port 8001).
2. **Device / Emulator APK Build**: Test packaging on Android emulator or physical device.
3. **End-to-End Demo Test**: Test 1-click report submission from mobile and observe real-time marker update on the web dashboard (`dashboard/index.html`).
