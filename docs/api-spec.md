# KrishiRakshak — API Specification

Base URLs:
- **ML Service**: `http://localhost:8001`
- **Backend API**: `http://localhost:8000`

---

## ML Inference Service (`:8001`)

### 1. Health Check
`GET /health`
```json
{
  "status": "healthy",
  "model_loaded": true,
  "num_classes": 38,
  "device": "cuda"
}
```

### 2. Predict Leaf Disease
`POST /predict`
- **Content-Type**: `multipart/form-data`
- **Body**: `file: Binary Image (JPEG/PNG/BMP)`

**Response (200 OK):**
```json
{
  "prediction": {
    "crop": "Tomato",
    "disease": "Late Blight",
    "class_name": "Tomato___Late_blight",
    "confidence": 0.9654,
    "treatment": "Apply systemic fungicides (metalaxyl + mancozeb) immediately — this disease spreads extremely fast in wet conditions. Remove and destroy infected plants.",
    "inference_time_ms": 142.3
  },
  "top_3": [
    {
      "crop": "Tomato",
      "disease": "Late Blight",
      "class_name": "Tomato___Late_blight",
      "confidence": 0.9654,
      "treatment": "...",
      "inference_time_ms": 142.3
    },
    {
      "crop": "Tomato",
      "disease": "Early Blight",
      "class_name": "Tomato___Early_blight",
      "confidence": 0.0211,
      "treatment": "...",
      "inference_time_ms": 142.3
    },
    {
      "crop": "Tomato",
      "disease": "Septoria Leaf Spot",
      "class_name": "Tomato___Septoria_leaf_spot",
      "confidence": 0.0084,
      "treatment": "...",
      "inference_time_ms": 142.3
    }
  ]
}
```

---

## Backend API (`:8000`)

### 1. Log New Field Scan
`POST /api/scans`
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "device_id": "farmer_dev_9821",
  "crop": "Tomato",
  "disease": "Late Blight",
  "confidence": 0.965,
  "latitude": 14.6819,
  "longitude": 77.6006,
  "treatment": "Apply systemic fungicides..."
}
```

**Response (201 Created):**
```json
{
  "id": "e9b28fb3-3d02-45e6-bb3f-42e12ff912a0",
  "device_id": "farmer_dev_9821",
  "crop": "Tomato",
  "disease": "Late Blight",
  "confidence": 0.965,
  "latitude": 14.6819,
  "longitude": 77.6006,
  "geohash": "tdr1v472h1p9",
  "image_url": null,
  "treatment": "Apply systemic fungicides...",
  "created_at": "2026-08-25T17:30:00Z"
}
```

### 2. Query Scan Reports
`GET /api/scans?crop=Tomato&limit=50&offset=0`

**Response (200 OK):**
```json
{
  "total": 1,
  "scans": [
    {
      "id": "e9b28fb3-3d02-45e6-bb3f-42e12ff912a0",
      "device_id": "farmer_dev_9821",
      "crop": "Tomato",
      "disease": "Late Blight",
      "confidence": 0.965,
      "latitude": 14.6819,
      "longitude": 77.6006,
      "geohash": "tdr1v472h1p9",
      "image_url": null,
      "treatment": "Apply systemic fungicides...",
      "created_at": "2026-08-25T17:30:00Z"
    }
  ]
}
```

### 3. List Active Outbreak Alerts
`GET /api/outbreaks`

**Response (200 OK):**
```json
{
  "total": 1,
  "alerts": [
    {
      "id": "21a5ec40-77a8-4444-93ff-2a1e3895e7b2",
      "disease": "Late Blight",
      "crop": "Tomato",
      "geohash": "tdr1v",
      "case_count": 5,
      "center_lat": 14.6821,
      "center_lng": 77.6012,
      "first_reported": "2026-08-22T09:12:00Z",
      "last_reported": "2026-08-25T14:45:00Z",
      "created_at": "2026-08-25T17:30:00Z",
      "is_active": true
    }
  ]
}
```

### 4. Get Dashboard Statistics
`GET /api/stats`

**Response (200 OK):**
```json
{
  "total_scans": 24,
  "total_devices": 18,
  "total_outbreaks_active": 3,
  "disease_frequency": [
    { "crop": "Tomato", "disease": "Late Blight", "count": 6 },
    { "crop": "Grape", "disease": "Black Rot", "count": 5 },
    { "crop": "Bell Pepper", "disease": "Bacterial Spot", "count": 4 }
  ],
  "scans_last_7_days": 24,
  "scans_last_30_days": 24
}
```
