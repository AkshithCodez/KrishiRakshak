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

## Current Project State (What has been built)
- [x] Full directory scaffolding
- [x] Backend database models (UUID cross-compatible with Postgres/SQLite)
- [x] Backend REST API endpoints (`/scans`, `/outbreaks`, `/stats`)
- [x] Outbreak detection logic (`backend/app/services/outbreak.py`)
- [x] ML Training script structure & Serving API
- [x] Interactive Web Dashboard (`dashboard/index.html` with Leaflet auto-zoom)
- [x] `seed_data.py` script to generate fake outbreak clusters for demo purposes.

## Next Steps
1. **Machine Learning**: Download the PlantVillage dataset (14 crops, 38 classes) and run `train.py` to generate the `best_model.pt` weights.
2. **Mobile App**: Build the Flutter application in the `/mobile` directory, connect it to the Backend API and device camera.
3. **Integration Testing**: End-to-end test from mobile photo capture to dashboard alert generation.
