"""
KrishiRakshak — ML Inference Server

FastAPI service for plant disease prediction.

Endpoints:
    POST /predict  — Upload a leaf image, get diagnosis + treatment
    GET  /health   — Health check

Usage:
    uvicorn app:app --host 0.0.0.0 --port 8001
"""

import math
import os
import io
import json
import time
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image

# Import dataset & model from ml.src with fallback for direct execution
try:
    from ml.src.dataset import get_eval_transform
    from ml.src.model import PlantDiseaseClassifier
except ImportError:
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

# OOD Detection thresholds
# If top-1 confidence is below this, the image is rejected as unsupported.
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.65"))
# Secondary entropy guard: if distribution entropy exceeds this fraction of
# maximum possible entropy (log(num_classes)), also reject.
# 0.75 means "the distribution is only 25% more peaked than random" → too uncertain.
MAX_ENTROPY_RATIO = float(os.environ.get("MAX_ENTROPY_RATIO", "0.75"))

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

    # Load treatments first
    resolved_treatments_path = TREATMENTS_PATH
    if not os.path.exists(resolved_treatments_path):
        resolved_treatments_path = os.path.join(os.path.dirname(__file__), "treatments.json")

    if os.path.exists(resolved_treatments_path):
        with open(resolved_treatments_path) as f:
            treatments = json.load(f)
        print(f"[ML Server] Treatments loaded: {len(treatments)} entries")
    else:
        print(f"[ML Server] Warning: treatments.json not found at {resolved_treatments_path}")
        treatments = {}

    # Transform
    transform = get_eval_transform()

    # Load model checkpoint if available
    resolved_model_path = MODEL_PATH
    if not os.path.exists(resolved_model_path):
        # Try relative to ml/models
        alt_path = os.path.join(os.path.dirname(__file__), "..", "models", "best_model.pt")
        if os.path.exists(alt_path):
            resolved_model_path = alt_path

    if os.path.exists(resolved_model_path):
        print(f"[ML Server] Loading model from: {resolved_model_path}")
        checkpoint = torch.load(resolved_model_path, map_location=device, weights_only=False)
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
        print(f"[ML Server] Trained model loaded: {backbone}, {num_classes} classes")
    else:
        print(f"[ML Server] ⚠️ Model checkpoint not found at '{MODEL_PATH}'. Initializing in Demo Mode with untrained backbone.")
        class_names = list(treatments.keys()) if treatments else ["Healthy", "Blight"]
        num_classes = len(class_names)
        model = PlantDiseaseClassifier(
            num_classes=num_classes,
            backbone="mobilenetv2",
            freeze_backbone=False,
        )
        model = model.to(device)
        model.eval()
        print(f"[ML Server] Demo model initialized with {num_classes} classes.")

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
    success: bool = True
    is_supported: bool = True
    prediction: PredictionResult
    top_3: list[PredictionResult]


class OodRejectionResponse(BaseModel):
    success: bool = False
    is_supported: bool = False
    message: str
    confidence: float
    top_predictions: list[dict]


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


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Upload a leaf image and receive a disease diagnosis.

    - Accepted formats: JPEG, PNG, BMP, WebP
    - Max file size: 5 MB
    - Returns: top prediction + top-3 alternatives with treatments, OR an OOD
      rejection response if the image is not confidently classifiable.

    OOD Rejection Conditions (both checked):
      1. top-1 confidence < CONFIDENCE_THRESHOLD (default 0.65)
      2. Prediction entropy > MAX_ENTROPY_RATIO * log(num_classes)
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

    # ── Inference ─────────────────────────────────────────────────────────────
    start = time.time()
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(tensor)
        probs = torch.softmax(output, dim=1).squeeze()

    inference_ms = (time.time() - start) * 1000

    # ── OOD Detection ─────────────────────────────────────────────────────────
    top_confidence = probs.max().item()

    # Shannon entropy of the softmax distribution
    # High entropy = uncertain / spread out = likely OOD
    entropy = -float(torch.sum(probs * torch.log(probs + 1e-9)))
    max_possible_entropy = math.log(len(class_names))  # log(38) ≈ 3.64
    entropy_ratio = entropy / max_possible_entropy

    # Build top-3 summary regardless (returned in rejection too for debugging)
    top_probs, top_indices = probs.topk(min(3, len(class_names)))
    results = []
    for prob, idx in zip(top_probs, top_indices):
        class_name = class_names[idx.item()]
        parts = class_name.split("___")
        crop = parts[0].replace("_", " ") if len(parts) >= 1 else "Unknown"
        disease_name = parts[1].replace("_", " ") if len(parts) >= 2 else "Unknown"

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

    # Reject if below confidence threshold OR entropy is too high
    is_low_confidence = top_confidence < CONFIDENCE_THRESHOLD
    is_high_entropy = entropy_ratio > MAX_ENTROPY_RATIO

    if is_low_confidence or is_high_entropy:
        rejection_reason = []
        if is_low_confidence:
            rejection_reason.append(f"top confidence {top_confidence:.1%} < threshold {CONFIDENCE_THRESHOLD:.1%}")
        if is_high_entropy:
            rejection_reason.append(f"entropy ratio {entropy_ratio:.2f} > max {MAX_ENTROPY_RATIO}")

        print(
            f"[ML Server] OOD Rejection — "
            f"confidence={top_confidence:.3f}, entropy_ratio={entropy_ratio:.2f} — "
            f"Reason: {'; '.join(rejection_reason)}"
        )

        return JSONResponse(
            status_code=200,
            content={
                "success": False,
                "is_supported": False,
                "message": (
                    "Image could not be reliably classified. "
                    "Please ensure the photo is clear and shows a leaf from one of the "
                    "14 supported crops (e.g. Tomato, Potato, Apple, Corn, Peach, "
                    "Cherry, Pepper, Blueberry, Raspberry, Soybean, Squash, Strawberry, "
                    "Orange, or Grape)."
                ),
                "confidence": round(top_confidence, 4),
                "entropy_ratio": round(entropy_ratio, 4),
                "top_predictions": [
                    {"class": r.class_name, "confidence": r.confidence}
                    for r in results
                ],
            },
        )

    # ── Successful Prediction ─────────────────────────────────────────────────
    print(
        f"[ML Server] Prediction accepted — "
        f"{results[0].class_name} @ {top_confidence:.1%} "
        f"(entropy_ratio={entropy_ratio:.2f})"
    )

    return {
        "success": True,
        "is_supported": True,
        "prediction": results[0].model_dump(),
        "top_3": [r.model_dump() for r in results],
    }
