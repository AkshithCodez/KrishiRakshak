"""
KrishiRakshak — ONNX Export Tool

Converts a trained PyTorch model (.pt) into an ONNX format (.onnx)
for optimized edge inference and mobile cross-platform support.

Usage:
    python export_onnx.py --model-path ../models/best_model.pt --output ../models/model.onnx
"""

import os
import argparse
import torch

from model import PlantDiseaseClassifier


def parse_args():
    parser = argparse.ArgumentParser(description="Export PyTorch model to ONNX")
    parser.add_argument("--model-path", type=str, required=True, help="Path to best_model.pt")
    parser.add_argument("--output", type=str, default="models/model.onnx", help="Output path for .onnx file")
    parser.add_argument("--img-size", type=int, default=224, help="Input image dimension (224)")
    return parser.parse_args()


def export_to_onnx():
    args = parse_args()

    if not os.path.exists(args.model_path):
        raise FileNotFoundError(f"Checkpoint not found at: {args.model_path}")

    device = torch.device("cpu")
    print(f"Loading checkpoint from: {args.model_path}")
    checkpoint = torch.load(args.model_path, map_location=device, weights_only=False)

    class_names = checkpoint["class_names"]
    backbone = checkpoint.get("backbone", "mobilenetv2")
    num_classes = len(class_names)

    model = PlantDiseaseClassifier(
        num_classes=num_classes,
        backbone=backbone,
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Dummy tensor matching input shape [batch_size, channels, height, width]
    dummy_input = torch.randn(1, 3, args.img_size, args.img_size, requires_grad=False)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    print(f"Exporting model to ONNX format at: {args.output}")

    export_kwargs = {
        "export_params": True,
        "opset_version": 14,
        "do_constant_folding": True,
        "input_names": ["input"],
        "output_names": ["output"],
        "dynamic_axes": {
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        },
    }

    try:
        # PyTorch 2.1+ legacy flag if onnxscript is not installed
        torch.onnx.export(model, dummy_input, args.output, dynamo=False, **export_kwargs)
    except TypeError:
        torch.onnx.export(model, dummy_input, args.output, **export_kwargs)

    print("✓ Successfully exported to ONNX format!")


if __name__ == "__main__":
    export_to_onnx()
