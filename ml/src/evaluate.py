"""
KrishiRakshak — Evaluation Module

Per-class precision/recall/F1, confusion matrix, and accuracy reporting.

Usage:
    python evaluate.py --data-dir data/raw --checkpoint models/best_model.pt
"""

import os
import argparse
import json

import torch
import torch.nn as nn
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)
from tqdm import tqdm

from dataset import get_data_loaders
from model import PlantDiseaseClassifier


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate plant disease classifier")
    parser.add_argument("--data-dir", type=str, required=True)
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to best_model.pt")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--output-dir", type=str, default="models", help="Save evaluation results here")
    parser.add_argument("--split", type=str, default="test", choices=["val", "test"])
    return parser.parse_args()


@torch.no_grad()
def collect_predictions(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    device: torch.device,
) -> tuple:
    """Run inference on entire dataset and collect predictions + ground truth."""
    model.eval()
    all_preds = []
    all_labels = []
    all_probs = []

    for images, labels in tqdm(loader, desc="Collecting predictions"):
        images = images.to(device)
        outputs = model(images)
        probs = torch.softmax(outputs, dim=1)
        _, predicted = outputs.max(1)

        all_preds.extend(predicted.cpu().numpy())
        all_labels.extend(labels.numpy())
        all_probs.extend(probs.cpu().numpy())

    return np.array(all_preds), np.array(all_labels), np.array(all_probs)


def plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: list,
    output_path: str,
):
    """Plot and save a confusion matrix heatmap."""
    cm = confusion_matrix(y_true, y_pred)
    # Normalize by row (true labels)
    cm_norm = cm.astype("float") / cm.sum(axis=1, keepdims=True)

    fig, ax = plt.subplots(figsize=(20, 18))
    sns.heatmap(
        cm_norm,
        annot=True,
        fmt=".2f",
        cmap="YlOrRd",
        xticklabels=class_names,
        yticklabels=class_names,
        ax=ax,
        vmin=0,
        vmax=1,
        linewidths=0.5,
    )
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    ax.set_title("Normalized Confusion Matrix", fontsize=14)
    plt.xticks(rotation=90, fontsize=7)
    plt.yticks(rotation=0, fontsize=7)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Confusion matrix saved to {output_path}")


def plot_per_class_accuracy(
    report_dict: dict,
    class_names: list,
    output_path: str,
):
    """Plot per-class recall (sensitivity) as a horizontal bar chart."""
    recalls = [report_dict[name]["recall"] for name in class_names]
    colors = [
        "#e74c3c" if r < 0.75 else "#f39c12" if r < 0.90 else "#27ae60"
        for r in recalls
    ]

    fig, ax = plt.subplots(figsize=(10, 14))
    y_pos = range(len(class_names))
    ax.barh(y_pos, recalls, color=colors, height=0.7)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(class_names, fontsize=8)
    ax.set_xlabel("Recall", fontsize=12)
    ax.set_title("Per-Class Recall (🔴 <75%  🟡 75-90%  🟢 >90%)", fontsize=13)
    ax.axvline(x=0.75, color="#e74c3c", linestyle="--", alpha=0.5, label="75% threshold")
    ax.axvline(x=0.90, color="#f39c12", linestyle="--", alpha=0.5, label="90% threshold")
    ax.set_xlim(0, 1.05)
    ax.legend(fontsize=9)
    ax.invert_yaxis()
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Per-class accuracy chart saved to {output_path}")


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # ── Load checkpoint ──
    print(f"Loading checkpoint: {args.checkpoint}")
    checkpoint = torch.load(args.checkpoint, map_location=device)
    class_names = checkpoint["class_names"]
    num_classes = checkpoint["num_classes"] if "num_classes" in checkpoint else len(class_names)
    backbone = checkpoint.get("backbone", "mobilenetv2")

    # ── Load data ──
    train_loader, val_loader, test_loader, _, _ = get_data_loaders(
        data_dir=args.data_dir,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
    )
    loader = test_loader if args.split == "test" else val_loader

    # ── Build model and load weights ──
    model = PlantDiseaseClassifier(
        num_classes=num_classes,
        backbone=backbone,
        freeze_backbone=False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)

    # ── Collect predictions ──
    y_pred, y_true, y_probs = collect_predictions(model, loader, device)

    # ── Classification Report ──
    overall_acc = accuracy_score(y_true, y_pred)
    print(f"\n{'='*60}")
    print(f"Overall {args.split} accuracy: {overall_acc:.4f}")
    print(f"{'='*60}\n")

    report_str = classification_report(y_true, y_pred, target_names=class_names, digits=4)
    print(report_str)

    report_dict = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True
    )

    # ── Identify weak classes ──
    print(f"\n{'='*60}")
    print("Classes with recall < 85%:")
    print(f"{'='*60}")
    weak_classes = []
    for name in class_names:
        recall = report_dict[name]["recall"]
        support = report_dict[name]["support"]
        if recall < 0.85:
            weak_classes.append((name, recall, support))
            print(f"  ⚠ {name}: recall={recall:.4f} (n={int(support)})")

    if not weak_classes:
        print("  ✓ All classes above 85% recall!")

    # ── Save results ──
    results = {
        "split": args.split,
        "overall_accuracy": overall_acc,
        "classification_report": report_dict,
        "weak_classes": [
            {"name": n, "recall": r, "support": int(s)}
            for n, r, s in weak_classes
        ],
        "checkpoint": args.checkpoint,
    }
    results_path = os.path.join(args.output_dir, f"eval_{args.split}.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {results_path}")

    # ── Plot confusion matrix ──
    cm_path = os.path.join(args.output_dir, f"confusion_matrix_{args.split}.png")
    plot_confusion_matrix(y_true, y_pred, class_names, cm_path)

    # ── Plot per-class recall ──
    recall_path = os.path.join(args.output_dir, f"per_class_recall_{args.split}.png")
    plot_per_class_accuracy(report_dict, class_names, recall_path)


if __name__ == "__main__":
    main()
