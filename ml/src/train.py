"""
KrishiRakshak — Training Script

CLI entrypoint for training the plant disease classifier.

Usage:
    # Phase 1: Frozen backbone baseline
    python train.py --data-dir data/raw --epochs 15 --freeze-backbone

    # Phase 2: Fine-tune top 30% of backbone
    python train.py --data-dir data/raw --epochs 30 --unfreeze-fraction 0.3 \
                    --backbone-lr 1e-4 --head-lr 1e-3 --resume models/baseline.pt

    # With weighted sampler for minority classes
    python train.py --data-dir data/raw --epochs 30 --use-weighted-sampler
"""

import os
import argparse
import json
import time
from datetime import datetime

import torch
import torch.nn as nn
from torch.optim import Adam
from torch.optim.lr_scheduler import ReduceLROnPlateau
from tqdm import tqdm

from dataset import get_data_loaders, save_class_info
from model import PlantDiseaseClassifier


def parse_args():
    parser = argparse.ArgumentParser(description="Train KrishiRakshak plant disease classifier")

    # Data
    parser.add_argument("--data-dir", type=str, required=True, help="Path to PlantVillage dataset root")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--num-workers", type=int, default=2)

    # Model
    parser.add_argument("--backbone", type=str, default="mobilenetv2",
                        choices=["mobilenetv2", "efficientnet_b0"])
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument("--freeze-backbone", action="store_true",
                        help="Freeze all backbone layers (for baseline training)")
    parser.add_argument("--unfreeze-fraction", type=float, default=0.0,
                        help="Fraction of backbone layers to unfreeze (e.g., 0.3 for top 30%%)")

    # Training
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--head-lr", type=float, default=1e-3, help="Learning rate for classifier head")
    parser.add_argument("--backbone-lr", type=float, default=1e-4, help="Learning rate for backbone (fine-tuning)")
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=5, help="Early stopping patience")
    parser.add_argument("--use-weighted-sampler", action="store_true",
                        help="Oversample minority classes during training")

    # Checkpoints
    parser.add_argument("--resume", type=str, default=None, help="Path to checkpoint to resume from")
    parser.add_argument("--output-dir", type=str, default="models", help="Directory to save checkpoints")

    return parser.parse_args()


def train_one_epoch(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> dict:
    """Train for one epoch. Returns metrics dict."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(loader, desc="Training", leave=False)
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()

        pbar.set_postfix(loss=f"{loss.item():.4f}", acc=f"{correct/total:.4f}")

    return {
        "loss": running_loss / total,
        "accuracy": correct / total,
    }


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> dict:
    """Evaluate model on val/test set. Returns metrics dict."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in tqdm(loader, desc="Evaluating", leave=False):
        images, labels = images.to(device), labels.to(device)

        outputs = model(images)
        loss = criterion(outputs, labels)

        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()

    return {
        "loss": running_loss / total,
        "accuracy": correct / total,
    }


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    # ── Device ──
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # ── Data ──
    print(f"\nLoading dataset from: {args.data_dir}")
    train_loader, val_loader, test_loader, class_names, class_weights = get_data_loaders(
        data_dir=args.data_dir,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        use_weighted_sampler=args.use_weighted_sampler,
    )
    num_classes = len(class_names)
    print(f"Number of classes: {num_classes}")

    # Save class info for serving layer
    save_class_info(class_names, class_weights, os.path.join(args.output_dir, "class_info.json"))

    # ── Model ──
    freeze = args.freeze_backbone or args.unfreeze_fraction == 0.0
    model = PlantDiseaseClassifier(
        num_classes=num_classes,
        backbone=args.backbone,
        dropout=args.dropout,
        freeze_backbone=freeze,
    )

    # Unfreeze top layers if specified
    if args.unfreeze_fraction > 0:
        model.unfreeze_top_layers(args.unfreeze_fraction)

    # Resume from checkpoint
    if args.resume:
        print(f"Resuming from: {args.resume}")
        checkpoint = torch.load(args.resume, map_location=device)
        model.load_state_dict(checkpoint["model_state_dict"])

    model = model.to(device)
    param_info = model.count_parameters()
    print(f"Parameters: {param_info}")

    # ── Loss, Optimizer, Scheduler ──
    class_weights = class_weights.to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    if args.unfreeze_fraction > 0:
        # Differential learning rates for fine-tuning
        param_groups = model.get_optimizer_param_groups(
            backbone_lr=args.backbone_lr, head_lr=args.head_lr
        )
    else:
        param_groups = [{"params": model.parameters(), "lr": args.head_lr}]

    optimizer = Adam(param_groups, weight_decay=args.weight_decay)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", patience=3, factor=0.5)

    # ── Training Loop ──
    best_val_acc = 0.0
    patience_counter = 0
    history = []

    print(f"\n{'='*60}")
    print(f"Training: {args.backbone} | {args.epochs} epochs | Frozen: {freeze}")
    print(f"{'='*60}\n")

    for epoch in range(1, args.epochs + 1):
        start_time = time.time()

        # Train
        train_metrics = train_one_epoch(model, train_loader, criterion, optimizer, device)

        # Validate
        val_metrics = evaluate(model, val_loader, criterion, device)

        # Scheduler step
        scheduler.step(val_metrics["loss"])

        elapsed = time.time() - start_time

        # Logging
        print(
            f"Epoch {epoch:3d}/{args.epochs} | "
            f"Train Loss: {train_metrics['loss']:.4f} Acc: {train_metrics['accuracy']:.4f} | "
            f"Val Loss: {val_metrics['loss']:.4f} Acc: {val_metrics['accuracy']:.4f} | "
            f"Time: {elapsed:.1f}s"
        )

        history.append({
            "epoch": epoch,
            "train_loss": train_metrics["loss"],
            "train_acc": train_metrics["accuracy"],
            "val_loss": val_metrics["loss"],
            "val_acc": val_metrics["accuracy"],
            "time_seconds": elapsed,
        })

        # Checkpoint best model
        if val_metrics["accuracy"] > best_val_acc:
            best_val_acc = val_metrics["accuracy"]
            patience_counter = 0
            checkpoint_path = os.path.join(args.output_dir, "best_model.pt")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_accuracy": best_val_acc,
                "backbone": args.backbone,
                "num_classes": num_classes,
                "class_names": class_names,
            }, checkpoint_path)
            print(f"  ✓ New best model saved: {best_val_acc:.4f}")
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                print(f"\nEarly stopping at epoch {epoch} (patience={args.patience})")
                break

    # ── Final Evaluation on Test Set ──
    print(f"\n{'='*60}")
    print("Loading best model for test evaluation...")
    best_checkpoint = torch.load(
        os.path.join(args.output_dir, "best_model.pt"), map_location=device
    )
    model.load_state_dict(best_checkpoint["model_state_dict"])

    test_metrics = evaluate(model, test_loader, criterion, device)
    print(f"Test Accuracy: {test_metrics['accuracy']:.4f}")
    print(f"Test Loss:     {test_metrics['loss']:.4f}")

    # ── Save Training History ──
    history_path = os.path.join(args.output_dir, "training_history.json")
    with open(history_path, "w") as f:
        json.dump({
            "config": vars(args),
            "best_val_accuracy": best_val_acc,
            "test_accuracy": test_metrics["accuracy"],
            "history": history,
            "timestamp": datetime.now().isoformat(),
        }, f, indent=2)
    print(f"Training history saved to {history_path}")
    print(f"\nDone! Best validation accuracy: {best_val_acc:.4f}")


if __name__ == "__main__":
    main()
