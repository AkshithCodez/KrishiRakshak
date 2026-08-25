"""
KrishiRakshak — ML Inference Server

FastAPI service for plant disease prediction.

Endpoints:
    POST /predict  — Upload a leaf image, get diagnosis + treatment
    GET  /health   — Health check

Usage:
    uvicorn app:app --host 0.0.0.0 --port 8001
"""

import os
import io
import json
import time
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

# These imports assume the serving dir is run with ml/src on the Python path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dataset import get_eval_transform
from model import PlantDiseaseClassifier


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

MODEL_PATH = os.environ.get("MODEL_PATH", "../models/best_model.pt")
TREATMENTS_PATH = os.environ.get("TREATMENTS_PATH", "treatments.json")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/bmp", "image/webp"}

# ──────────────────────────────────────────────
# Global state (loaded at startup)
# ──────────────────────────────────────────────

model = None
class_names = None
treatments = None
transform = None
device = None


def load_model():
    """Load the trained model and treatments at startup."""
    global model, class_names, treatments, transform, device

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[ML Server] Device: {device}")

    # Load model checkpoint
    print(f"[ML Server] Loading model from: {MODEL_PATH}")
    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    class_names = checkpoint["class_names"]
    backbone = checkpoint.get("backbone", "mobilenetv2")
    num_classes = len(class_names)

    model = PlantDiseaseClassifier(
        num_classes=num_classes,
        backbone=backbone,
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)
    model.eval()
    print(f"[ML Server] Model loaded: {backbone}, {num_classes} classes")

    # Load treatments
    if os.path.exists(TREATMENTS_PATH):
        with open(TREATMENTS_PATH) as f:
            treatments = json.load(f)
        print(f"[ML Server] Treatments loaded: {len(treatments)} entries")
    else:
        print(f"[ML Server] Warning: treatments.json not found at {TREATMENTS_PATH}")
        treatments = {}

    # Transform
    transform = get_eval_transform()

    # Warmup inference
    dummy = torch.randn(1, 3, 224, 224).to(device)
    with torch.no_grad():
        _ = model(dummy)
    print("[ML Server] Warmup complete")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    load_model()
    yield


# ──────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────

app = FastAPI(
    title="KrishiRakshak ML Service",
    description="Plant disease diagnosis from leaf images",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Response Schemas
# ──────────────────────────────────────────────

class PredictionResult(BaseModel):
    crop: str
    disease: str
    class_name: str
    confidence: float
    treatment: str
    inference_time_ms: float


class PredictionResponse(BaseModel):
    prediction: PredictionResult
    top_3: list[PredictionResult]


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "num_classes": len(class_names) if class_names else 0,
        "device": str(device),
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    """
    Upload a leaf image and receive a disease diagnosis.
    
    - Accepted formats: JPEG, PNG, BMP, WebP
    - Max file size: 5 MB
    - Returns: top prediction + top-3 alternatives with treatments
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Accepted: {ALLOWED_TYPES}",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(contents)} bytes). Max: {MAX_FILE_SIZE} bytes.",
        )

    # Open image
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image file.")

    # Inference
    start = time.time()
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(tensor)
        probs = torch.softmax(output, dim=1).squeeze()

    inference_ms = (time.time() - start) * 1000

    # Top-3 predictions
    top_probs, top_indices = probs.topk(3)
    results = []
    for prob, idx in zip(top_probs, top_indices):
        class_name = class_names[idx.item()]
        parts = class_name.split("___")
        crop = parts[0].replace("_", " ") if len(parts) >= 1 else "Unknown"
        disease_name = parts[1].replace("_", " ") if len(parts) >= 2 else "Unknown"

        # Look up treatment
        treatment_text = "No treatment information available."
        if class_name in treatments:
            treatment_text = treatments[class_name].get("recommendation", treatment_text)
        elif disease_name.lower() == "healthy":
            treatment_text = "No disease detected. Continue regular monitoring and care."

        results.append(PredictionResult(
            crop=crop,
            disease=disease_name,
            class_name=class_name,
            confidence=round(prob.item(), 4),
            treatment=treatment_text,
            inference_time_ms=round(inference_ms, 1),
        ))

    return PredictionResponse(
        prediction=results[0],
        top_3=results,
    )
