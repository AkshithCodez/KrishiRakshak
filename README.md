# KrishiRakshak - Local Run Instructions

This guide explains how to start the project locally on your Windows machine using the Python Virtual Environment.

## Prerequisites
Make sure you have already installed the requirements in your virtual environment:
```powershell
.\venv\Scripts\Activate.ps1
pip install -r ml/requirements.txt
pip install -r backend/requirements.txt
```

---

## How to Run the Project (Local Testing)

You will need to open **three separate PowerShell terminals** inside the `KrishiRakshak` root directory.

### 🟢 Terminal 1: Start the ML Service
This service handles the AI predictions.
```powershell
.\venv\Scripts\Activate.ps1
uvicorn ml.serving.app:app --host 0.0.0.0 --port 8001
```
*(Leave this running. If you haven't trained the model yet, it will safely start in "Demo Mode".)*

### 🟢 Terminal 2: Start the Backend API
This service handles the database, farmers' reports, and outbreak detection.
```powershell
.\venv\Scripts\Activate.ps1
# Tell the backend to use a local SQLite file instead of Docker/Postgres
$env:DATABASE_URL="sqlite:///./krishirakshak.db"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
*(Leave this running.)*

### 🟢 Terminal 3: Generate Demo Data (Optional)
Run this script to inject fake farmer reports and trigger the regional outbreak alerts. You only need to run this once per session to populate the dashboard.
```powershell
.\venv\Scripts\Activate.ps1
$env:DATABASE_URL="sqlite:///./krishirakshak.db"
python backend/seed_data.py
```

---

## Open the application

With both services running, open:

- Public landing page: <http://localhost:8000/>
- Officer dashboard: <http://localhost:8000/officer.html>

Use the HTTP URLs above rather than opening the HTML file directly. The farmer
photo modal uses `/api/diagnose`, a same-origin adapter to the existing ML
`/predict` endpoint. Crop hints are forwarded as query parameters, matching the
current ML contract. Reports use the existing `/api/scans` endpoint and request
the farmer's location only on submission. Camera/location access on a physical
phone requires HTTPS (localhost is allowed for local desktop testing).

The public page has a nine-stage desktop story and six-stage phone story. It
serves `dashboard/models/TomatoPlant_Final.glb` with local Three.js 0.160.0 modules.
All story examples are illustrations; installation records appear in the officer
dashboard. Seeded records are demonstration data. The existing classifier needs
independent validation before its results can be relied on in the field.

The officer map uses the standard OpenStreetMap tile service with attribution.
Follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
when deploying beyond local evaluation. Map tiles and the existing officer-page
Leaflet/Chart.js dependencies require an internet connection.

## Landing-page verification

```powershell
$env:PYTHONDONTWRITEBYTECODE="1"
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

Tests isolate report writes in an in-memory database. The browser harness at
`tests/browser-harness.html` can be temporarily copied to `dashboard/qa.html` and
opened at `/qa.html` for reduced-motion, WebGL-failure, diagnosis and report
failure tests. It uses clearly labeled synthetic responses without posting
reports. Remove that temporary copy after testing.
