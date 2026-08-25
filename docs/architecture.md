# KrishiRakshak — System Architecture

**Farmers Disease Diagnostic & Regional Outbreak Surveillance Portal**

## 1. High-Level Architecture

```mermaid
graph TD
    subgraph Client Layer
        Mobile["📱 Flutter Mobile App<br/>(Camera + Geolocation + History + Outbreaks)"]
        Dashboard["💻 Web Dashboard<br/>(Leaflet Map + Chart.js + Live Alerts)"]
    end

    subgraph Service Layer
        MLService["🧠 ML Inference Service<br/>(FastAPI :8001)<br/>• MobileNetV2 / EfficientNet-B0<br/>• 38 PlantVillage Classes<br/>• Treatment Knowledge Base"]
        BackendAPI["⚙️ Backend API<br/>(FastAPI :8000)<br/>• Geohash Spatial Indexer<br/>• Outbreak Aggregator (7-day window)<br/>• Scan History & Analytics"]
    end

    subgraph Data Layer
        Postgres[("🐘 PostgreSQL 15<br/>• scan_reports<br/>• outbreak_alerts")]
    end

    Mobile -->|"1. POST /predict (leaf photo)"| MLService
    MLService -->|"2. {crop, disease, confidence, treatment}"| Mobile
    Mobile -->|"3. POST /api/scans (+ GPS lat/lng)"| BackendAPI
    BackendAPI -->|"4. Calculate Geohash & Insert"| Postgres
    BackendAPI -->|"5. Evaluate Outbreak Cluster Query"| Postgres
    Dashboard -->|"GET /api/stats, /api/outbreaks, /api/scans"| BackendAPI
```

---

## 2. Component Breakdown

### A. Machine Learning Pipeline (`/ml`)
- **Dataset**: PlantVillage benchmark (14 crops, 38 diseased & healthy classes).
- **Architecture**: Transfer learning on `MobileNetV2` and `EfficientNet-B0` backbones with ImageNet initialization and a 2-layer dense classifier head with Dropout.
- **Class Imbalance Strategy**:
  - Inverse-frequency weighted `CrossEntropyLoss` ($w_i = \frac{N}{C \cdot n_i}$).
  - Tiered data augmentation: aggressive affine, blur, and random erasing for minority classes ($n < 500$ images, e.g., Potato Healthy).
  - Optional `WeightedRandomSampler` for balanced epoch sampling.
- **Serving**: FastAPI service returning top-1 diagnosis, top-3 confidence rankings, and agronomically verified treatment recommendations in $<500$ms.

### B. Backend API (`/backend`)
- **Framework**: FastAPI (Python 3.11) + SQLAlchemy 2.0.
- **Geospatial Engine**: Geohash grid indexing (precision 5 = ~4.9 km cells) for efficient spatial grouping without heavy PostGIS overhead.
- **Outbreak Detection**:
  - Rolling window: 7 days.
  - Outbreak condition: $\ge 3$ distinct `device_id` reporting the same non-healthy disease in the same ~5km geohash cell.

### C. Mobile Application (`/mobile`)
- **Framework**: Flutter (Dart).
- **Features**:
  - Live camera photo capture and gallery import.
  - Instant leaf diagnosis with confidence percentage and actionable treatments.
  - Automatic geolocation tagging with background scan logging.
  - Personal scan history with offline SQLite / backend sync.
  - Community Outbreak alerts feed for regional early warning.

### D. Regional Dashboard (`/dashboard`)
- **Framework**: Modern vanilla HTML5 / CSS3 / JavaScript (zero build step).
- **Features**:
  - Real-time interactive map (Leaflet.js) displaying field scan locations color-coded by disease severity.
  - Live community outbreak alert cards with case counters and affected geohash zones.
  - Top 10 disease frequency distribution chart (Chart.js).
  - Auto-refresh surveillance feed every 30 seconds.
