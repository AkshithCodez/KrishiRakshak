# KrishiRakshak 🌿
**Farmers Disease Diagnostic & Regional Outbreak Reporting Portal**

An end-to-end AI-powered mobile and web platform that diagnoses crop leaf diseases using deep learning (PlantVillage 38 classes across 14 crops) and detects regional disease outbreaks by analyzing community geolocation scan density.

---

## 🚀 Key Features

- **Leaf Disease Diagnosis (38 Classes)**: Transfer learning CNN (`MobileNetV2` / `EfficientNet-B0`) providing instant diagnoses with confidence levels and agronomically verified treatments.
- **Community Outbreak Surveillance (The Differentiator)**: Geohash-based spatial aggregation automatically detects regional outbreaks when $\ge 3$ distinct farmers report matching diseases within a ~5km radius over a rolling 7-day window.
- **Flutter Mobile App**: Camera photo capture, gallery upload, scan history, and community outbreak warning cards.
- **Surveillance Web Dashboard**: Real-time Leaflet.js map with disease geolocation pins, Chart.js disease frequency statistics, and live outbreak alert feeds.

---

## 📁 Repository Structure

```
KrishiRakshak/
├── ml/                      # PyTorch model training, dataset, & FastAPI serving
│   ├── src/                 # dataset.py, model.py, train.py, evaluate.py, predict.py
│   ├── serving/             # app.py, treatments.json, Dockerfile
│   └── requirements.txt
│
├── backend/                 # FastAPI REST API & PostgreSQL persistence
│   ├── app/                 # routes/, services/ (geo & outbreak), models, db, schemas
│   ├── seed_data.py         # Synthetic scan reports & outbreak cluster generator
│   └── Dockerfile
│
├── mobile/                  # Flutter cross-platform mobile app
│   ├── lib/                 # main.dart, screens/, services/, models/
│   └── pubspec.yaml
│
├── dashboard/               # Lightweight Surveillance Web Dashboard
│   ├── index.html, style.css, app.js
│
├── docs/                    # Architecture diagrams & API documentation
│   ├── architecture.md
│   └── api-spec.md
│
└── docker-compose.yml       # One-command orchestration for ML + Backend + Postgres
```

---

## ⚡ Quick Start

### 1. Run with Docker Compose (Recommended)
```bash
docker-compose up --build
```
- **ML Service**: http://localhost:8001/docs
- **Backend API**: http://localhost:8000/docs
- **Postgres**: `localhost:5432`

### 2. Seed Simulated Demo Data
In a separate terminal:
```bash
docker-compose exec backend python seed_data.py
```
This populates sample scan reports and generates active outbreak clusters for immediate demonstration.

### 3. Open the Surveillance Dashboard
Simply open [dashboard/index.html](file:///c:/Users/reddy/Downloads/GoatFiles/project/Mini%20Project/KrishiRakshak/dashboard/index.html) in any web browser.

### 4. Run the Flutter Mobile App
```bash
cd mobile
flutter pub get
flutter run
```

---

## 🌿 Supported Crops & Diseases (14 Crops / 38 Classes)
- **Tomato** (7 diseases + Healthy): Early Blight, Late Blight, Bacterial Spot, Leaf Mold, Septoria, Spider Mites, Target Spot, Yellow Leaf Curl, Mosaic Virus.
- **Potato** (2 diseases + Healthy): Early Blight, Late Blight.
- **Corn / Maize** (3 diseases + Healthy): Cercospora (Gray Leaf Spot), Common Rust, Northern Leaf Blight.
- **Grape** (3 diseases + Healthy): Black Rot, Esca (Black Measles), Leaf Blight.
- **Apple** (3 diseases + Healthy): Apple Scab, Black Rot, Cedar Apple Rust.
- **Pepper Bell, Peach, Cherry, Strawberry, Squash, Orange, Blueberry, Raspberry, Soybean**.