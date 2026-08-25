"""
KrishiRakshak — Dataset Module

Custom PyTorch Dataset for PlantVillage with tier-based augmentation.
🟢 Large classes (>1100 images): standard augmentation
🟡 Medium classes (500-1100): standard augmentation  
🔴 Small classes (<500 images): aggressive augmentation

Usage:
    from dataset import PlantVillageDataset, get_data_loaders
    train_loader, val_loader, test_loader = get_data_loaders("data/raw", batch_size=32)
"""

import os
import json
from collections import Counter
from typing import Tuple, Dict, List, Optional

import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms
from PIL import Image
from sklearn.model_selection import train_test_split

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

IMG_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Threshold for "small" classes that get extra augmentation
SMALL_CLASS_THRESHOLD = 500

# ──────────────────────────────────────────────
# Augmentation Pipelines
# ──────────────────────────────────────────────

def get_standard_augmentation() -> transforms.Compose:
    """Standard augmentation for 🟢 Large and 🟡 Medium classes."""
    return transforms.Compose([
        transforms.RandomResizedCrop(IMG_SIZE, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(15),
        transforms.ColorJitter(
            brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1
        ),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_aggressive_augmentation() -> transforms.Compose:
    """Aggressive augmentation for 🔴 Small classes (<500 images)."""
    return transforms.Compose([
        transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.3),
        transforms.RandomRotation(20),
        transforms.ColorJitter(
            brightness=0.3, contrast=0.3, saturation=0.3, hue=0.15
        ),
        transforms.RandomAffine(
            degrees=0, translate=(0.1, 0.1), shear=10
        ),
        transforms.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
        transforms.ToTensor(),
        transforms.RandomErasing(p=0.2, scale=(0.02, 0.15)),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_eval_transform() -> transforms.Compose:
    """No augmentation — only resize + normalize. Used for val/test."""
    return transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


# ──────────────────────────────────────────────
# Dataset Class
# ──────────────────────────────────────────────

class PlantVillageDataset(Dataset):
    """
    PlantVillage dataset with per-class augmentation tiering.
    
    Args:
        image_paths: List of absolute image file paths.
        labels: List of integer labels corresponding to each image.
        class_names: List mapping label index → class name string.
        class_counts: Dict mapping label index → number of training images.
        transform_mode: One of 'train', 'val', 'test'.
    """

    def __init__(
        self,
        image_paths: List[str],
        labels: List[int],
        class_names: List[str],
        class_counts: Dict[int, int],
        transform_mode: str = "train",
    ):
        assert len(image_paths) == len(labels)
        self.image_paths = image_paths
        self.labels = labels
        self.class_names = class_names
        self.class_counts = class_counts
        self.transform_mode = transform_mode

        # Identify which classes are "small"
        self.small_classes = {
            idx for idx, count in class_counts.items()
            if count < SMALL_CLASS_THRESHOLD
        }

        # Pre-build transforms
        self.standard_aug = get_standard_augmentation()
        self.aggressive_aug = get_aggressive_augmentation()
        self.eval_transform = get_eval_transform()

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img = Image.open(self.image_paths[idx]).convert("RGB")
        label = self.labels[idx]

        if self.transform_mode == "train":
            # Use aggressive augmentation for small classes
            if label in self.small_classes:
                img = self.aggressive_aug(img)
            else:
                img = self.standard_aug(img)
        else:
            img = self.eval_transform(img)

        return img, label


# ──────────────────────────────────────────────
# Data Loading Utilities
# ──────────────────────────────────────────────

def scan_dataset(data_dir: str) -> Tuple[List[str], List[int], List[str]]:
    """
    Walk the PlantVillage directory structure and collect all image paths + labels.
    
    Expected structure:
        data_dir/
            Apple___Apple_scab/
                img001.jpg
                img002.jpg
            Apple___healthy/
                ...
    
    Returns:
        image_paths, labels, class_names (sorted alphabetically)
    """
    class_names = sorted([
        d for d in os.listdir(data_dir)
        if os.path.isdir(os.path.join(data_dir, d))
    ])

    image_paths = []
    labels = []
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".JPG", ".JPEG", ".PNG"}

    for idx, class_name in enumerate(class_names):
        class_dir = os.path.join(data_dir, class_name)
        for fname in os.listdir(class_dir):
            if os.path.splitext(fname)[1] in valid_extensions:
                image_paths.append(os.path.join(class_dir, fname))
                labels.append(idx)

    return image_paths, labels, class_names


def compute_class_weights(labels: List[int], num_classes: int) -> torch.Tensor:
    """
    Compute inverse-frequency class weights for CrossEntropyLoss.
    
    Formula: weight_i = total_samples / (num_classes × class_i_count)
    """
    counter = Counter(labels)
    total = len(labels)
    weights = torch.zeros(num_classes)
    for i in range(num_classes):
        count = counter.get(i, 1)  # avoid division by zero
        weights[i] = total / (num_classes * count)
    return weights


def get_data_loaders(
    data_dir: str,
    batch_size: int = 32,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    num_workers: int = 4,
    use_weighted_sampler: bool = False,
    random_state: int = 42,
) -> Tuple[DataLoader, DataLoader, DataLoader, List[str], torch.Tensor]:
    """
    Build train/val/test DataLoaders from the PlantVillage directory.
    
    Args:
        data_dir: Path to the dataset root (e.g., "data/raw").
        batch_size: Batch size for all loaders.
        val_ratio: Fraction of data for validation.
        test_ratio: Fraction of data for testing.
        num_workers: Number of DataLoader workers.
        use_weighted_sampler: If True, oversample minority classes in training.
        random_state: Random seed for reproducibility.
        
    Returns:
        train_loader, val_loader, test_loader, class_names, class_weights
    """
    # Scan dataset
    image_paths, labels, class_names = scan_dataset(data_dir)
    num_classes = len(class_names)

    print(f"Found {len(image_paths)} images across {num_classes} classes")

    # Stratified split: train / (val+test) → then val / test
    train_paths, temp_paths, train_labels, temp_labels = train_test_split(
        image_paths, labels,
        test_size=val_ratio + test_ratio,
        stratify=labels,
        random_state=random_state,
    )
    relative_test = test_ratio / (val_ratio + test_ratio)
    val_paths, test_paths, val_labels, test_labels = train_test_split(
        temp_paths, temp_labels,
        test_size=relative_test,
        stratify=temp_labels,
        random_state=random_state,
    )

    print(f"Split: {len(train_paths)} train / {len(val_paths)} val / {len(test_paths)} test")

    # Class counts (from training set only)
    train_counter = Counter(train_labels)
    class_counts = {i: train_counter.get(i, 0) for i in range(num_classes)}

    # Class weights for loss function
    class_weights = compute_class_weights(train_labels, num_classes)

    # Build datasets
    train_dataset = PlantVillageDataset(
        train_paths, train_labels, class_names, class_counts, transform_mode="train"
    )
    val_dataset = PlantVillageDataset(
        val_paths, val_labels, class_names, class_counts, transform_mode="val"
    )
    test_dataset = PlantVillageDataset(
        test_paths, test_labels, class_names, class_counts, transform_mode="test"
    )

    # Sampler for training
    train_sampler = None
    shuffle = True
    if use_weighted_sampler:
        sample_weights = [
            class_weights[label].item() for label in train_labels
        ]
        train_sampler = WeightedRandomSampler(
            weights=sample_weights,
            num_samples=len(train_labels),
            replacement=True,
        )
        shuffle = False  # sampler and shuffle are mutually exclusive

    # Build loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        sampler=train_sampler,
        num_workers=num_workers,
        pin_memory=True,
        drop_last=True,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    return train_loader, val_loader, test_loader, class_names, class_weights


def save_class_info(class_names: List[str], class_weights: torch.Tensor, output_path: str):
    """Save class names and weights to JSON for use by the serving layer."""
    info = {
        "class_names": class_names,
        "class_weights": class_weights.tolist(),
        "num_classes": len(class_names),
    }
    with open(output_path, "w") as f:
        json.dump(info, f, indent=2)
    print(f"Class info saved to {output_path}")
