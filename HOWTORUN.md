# KrishiRakshak — Complete Run Guide (HOW TO RUN)

This document provides step-by-step commands to run the **ML Model Service**, the **FastAPI Backend API**, the **Web Outbreak Dashboard**, and the **Flutter Mobile App**.

---

## 📋 System Prerequisites

1. **Python Virtual Environment**: Activated in the project root.
2. **Flutter SDK**: Installed at `C:\src\flutter\bin` (or on your system PATH).
3. **Network Note**:
   - `mobile/lib/services/api_service.dart` is preconfigured to use your local IP (`192.168.0.134`) so that physical phones or emulators on the same Wi-Fi network can connect.
   - For web/browser testing (`flutter run -d chrome`), you can use `http://localhost:8001` (ML) and `http://localhost:8000` (Backend).

---

## 🚀 Running the Services (Step-by-Step)

Open **separate PowerShell terminal windows** from the `KrishiRakshak` root directory:

```powershell
cd "c:\Users\reddy\Downloads\GoatFiles\project\Mini Project\KrishiRakshak"
```

---

### 🟢 Terminal 1: ML Serving Service (FastAPI + PyTorch)
Runs the trained MobileNetV2 disease classification engine with crop-guided logit masking, OOD thresholding, and Top-3 candidate output.

```powershell
# 1. Activate Virtual Environment
.\venv\Scripts\Activate.ps1

# 2. Launch ML Service on Port 8001
uvicorn ml.serving.app:app --host 0.0.0.0 --port 8001 --reload
```

- **Health Check / Swagger Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **Predict Endpoint**: `POST http://localhost:8001/predict`

---

### 🟢 Terminal 2: Backend API Service (FastAPI + SQLite/Postgres)
Handles farmer authentication (Phone + OTP), scan ingestion, geohash spatial clustering, and regional outbreak alert computation.

```powershell
# 1. Activate Virtual Environment
.\venv\Scripts\Activate.ps1

# 2. Set SQLite database for local run
$env:DATABASE_URL="sqlite:///./krishirakshak.db"

# 3. Launch Backend Service on Port 8000
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Health Check / Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Scans Endpoint**: `GET / POST http://localhost:8000/api/scans`
- **Outbreaks Endpoint**: `GET http://localhost:8000/api/outbreaks`
- **Auth Endpoint**: `POST http://localhost:8000/api/auth/device`, `/api/auth/otp/send`, `/api/auth/otp/verify`

---

### 🟢 Terminal 3 (Optional): Seed Mock Outbreak Data
Injects fake farmer disease reports clustered geographically to test and demonstrate the regional outbreak detection immediately.

```powershell
# 1. Activate Virtual Environment
.\venv\Scripts\Activate.ps1

# 2. Seed Mock Outbreak Reports into SQLite
$env:DATABASE_URL="sqlite:///./krishirakshak.db"
python backend/seed_data.py
```

---

### 🟢 Terminal 4: Flutter Mobile Application
Runs the farmer-facing mobile app featuring:
- Language Selection Matrix (**7 Native Scripts**: తెలుగు, हिन्दी, English, ಕನ್ನಡ, தமிழ், मराठी, বাংলা)
- Phone Number + OTP Onboarding (with `1234` Demo OTP button)
- **Check My Crop** (Diagnose with crop selector)
- **History** & **Nearby Alerts**

```powershell
cd mobile

# Option A: Run in Chrome Browser (Instant testing)
C:\src\flutter\bin\flutter.bat run -d chrome

# Option B: Run on Connected Android Phone / Emulator
C:\src\flutter\bin\flutter.bat run -d android

# Option C: Build Release Android APK
C:\src\flutter\bin\flutter.bat build apk --release
# APK output will be created at: mobile/build/app/outputs/flutter-apk/app-release.apk
```

---

## 🗺️ Viewing the Web Portals

The new unified web architecture serves all three portals directly from the FastAPI backend:

1. Open your browser and navigate to: **[http://localhost:8000/](http://localhost:8000/)**
2. **Public Landing Page**: Explains the system and provides entry points.
3. **Farmer Portal**: Accessible via `http://localhost:8000/farmer.html`. Features language selection, OTP login, crop diagnosis, and nearby alerts.
4. **Officer Portal**: Accessible via `http://localhost:8000/officer.html`. Displays the live epidemiological map and outbreak clusters.

---

## 📱 Quick Testing Walkthrough

1. **First Launch**:
   - The app opens with the **Language Matrix**.
   - Tap **తెలుగు (Telugu)** or **हिन्दी (Hindi)**.
   - Tap **Continue**.
2. **Farmer Login**:
   - Enter any 10-digit mobile number (e.g. `9876543210`).
   - Tap **Send OTP**.
   - Tap the yellow **Use Demo OTP (1234)** button.
3. **Diagnose Crop**:
   - Tap **Check My Crop**.
   - Select a crop (e.g., 🍑 **Peach** or 🍅 **Tomato**), or leave on 🌿 **Auto**.
   - Tap **Take Photo** or **Select from Gallery**.
4. **1-Click Area Reporting**:
   - Review the **Initial AI Classification** and top-3 candidates.
   - Tap **📢 Report This Disease** and confirm.
5. **Verify**:
   - Open **Nearby Alerts** (Tab 3) to see the newly logged report count.
   - Refresh the web dashboard (`dashboard/index.html`) to see the marker placed on the map.
