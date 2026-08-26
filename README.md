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

## Viewing the Dashboard
Once the Backend API (Terminal 2) is running and you have seeded the data (Terminal 3), you can view the live dashboard:

1. Open your File Explorer.
2. Navigate to the `KrishiRakshak\dashboard\` folder.
3. Double-click **`index.html`** to open it in your web browser.

You can click the **⟳ Refresh Data** button in the dashboard to see new scans appear in real-time.