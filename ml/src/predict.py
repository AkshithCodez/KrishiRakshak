"""
KrishiRakshak — Single-Image Prediction Utility

Quick inference on a single image for testing/debugging.

Usage:
    python predict.py --image path/to/leaf.jpg --checkpoint models/best_model.pt
"""

import argparse
import json

import torch
from PIL import Image

from dataset import get_eval_transform
from model import PlantDiseaseClassifier


def parse_args():
    parser = argparse.ArgumentParser(description="Predict disease from a single leaf image")
    parser.add_argument("--image", type=str, required=True, help="Path to leaf image")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to best_model.pt")
    parser.add_argument("--treatments", type=str, default=None,
                        help="Path to treatments.json (optional)")
    parser.add_argument("--top-k", type=int, default=3, help="Show top-K predictions")
    return parser.parse_args()


@torch.no_grad()
def predict_single(
    image_path: str,
    model: torch.nn.Module,
    class_names: list,
    device: torch.device,
    top_k: int = 3,
) -> list:
    """
    Run inference on a single image.
    
    Returns:
        List of dicts: [{"class": str, "crop": str, "disease": str, "confidence": float}, ...]
    """
    transform = get_eval_transform()
    image = Image.open(image_path).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    model.eval()
    output = model(tensor)
    probs = torch.softmax(output, dim=1).squeeze()

    top_probs, top_indices = probs.topk(top_k)

    results = []
    for prob, idx in zip(top_probs, top_indices):
        class_name = class_names[idx.item()]
        # Parse "Crop___Disease" format
        parts = class_name.split("___")
        crop = parts[0].replace("_", " ") if len(parts) >= 1 else "Unknown"
        disease = parts[1].replace("_", " ") if len(parts) >= 2 else "Unknown"

        results.append({
            "class": class_name,
            "crop": crop,
            "disease": disease,
            "confidence": round(prob.item(), 4),
        })

    return results


def main():
    args = parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load checkpoint
    checkpoint = torch.load(args.checkpoint, map_location=device)
    class_names = checkpoint["class_names"]
    backbone = checkpoint.get("backbone", "mobilenetv2")
    num_classes = len(class_names)

    # Build model
    model = PlantDiseaseClassifier(
        num_classes=num_classes,
        backbone=backbone,
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)

    # Predict
    results = predict_single(args.image, model, class_names, device, top_k=args.top_k)

    # Load treatments if available
    treatments = {}
    if args.treatments:
        with open(args.treatments) as f:
            treatments = json.load(f)

    # Display results
    print(f"\nPrediction for: {args.image}")
    print(f"{'='*60}")
    for i, r in enumerate(results, 1):
        conf_bar = "█" * int(r["confidence"] * 30)
        print(f"\n  #{i}  {r['crop']} — {r['disease']}")
        print(f"      Confidence: {r['confidence']*100:.1f}% {conf_bar}")

        # Show treatment if available
        if r["class"] in treatments:
            t = treatments[r["class"]]
            print(f"      Treatment:  {t['recommendation']}")

    # Confidence warning
    if results[0]["confidence"] < 0.6:
        print(f"\n  ⚠ Low confidence ({results[0]['confidence']*100:.1f}%). "
              "Try a clearer photo with a single leaf against a plain background.")


if __name__ == "__main__":
    main()
