"""
KrishiRakshak — Model Architecture Module

Defines the plant disease classifier using transfer learning with
MobileNetV2 or EfficientNet-B0 as the backbone.

Usage:
    from model import PlantDiseaseClassifier
    model = PlantDiseaseClassifier(num_classes=38, backbone="mobilenetv2")
"""

import torch
import torch.nn as nn
from torchvision import models
from typing import Literal


class PlantDiseaseClassifier(nn.Module):
    """
    Transfer learning classifier for plant disease detection.
    
    Replaces the final classification head of a pretrained backbone
    with a custom head tuned for the PlantVillage 38-class problem.
    
    Args:
        num_classes: Number of output classes (38 for full PlantVillage).
        backbone: Which pretrained backbone to use.
        dropout: Dropout probability in the classifier head.
        freeze_backbone: If True, freeze all backbone layers initially.
    """

    SUPPORTED_BACKBONES = ("mobilenetv2", "efficientnet_b0")

    def __init__(
        self,
        num_classes: int = 38,
        backbone: Literal["mobilenetv2", "efficientnet_b0"] = "mobilenetv2",
        dropout: float = 0.3,
        freeze_backbone: bool = True,
    ):
        super().__init__()
        self.num_classes = num_classes
        self.backbone_name = backbone
        self.dropout_rate = dropout

        if backbone == "mobilenetv2":
            self._build_mobilenetv2(num_classes, dropout, freeze_backbone)
        elif backbone == "efficientnet_b0":
            self._build_efficientnet_b0(num_classes, dropout, freeze_backbone)
        else:
            raise ValueError(
                f"Unsupported backbone '{backbone}'. "
                f"Choose from: {self.SUPPORTED_BACKBONES}"
            )

    def _build_mobilenetv2(
        self, num_classes: int, dropout: float, freeze: bool
    ):
        """Set up MobileNetV2 with custom classifier head."""
        base = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)

        if freeze:
            for param in base.features.parameters():
                param.requires_grad = False

        # MobileNetV2 feature output: 1280-dim
        in_features = base.classifier[1].in_features
        base.classifier = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout * 0.5),
            nn.Linear(512, num_classes),
        )
        self.model = base

    def _build_efficientnet_b0(
        self, num_classes: int, dropout: float, freeze: bool
    ):
        """Set up EfficientNet-B0 with custom classifier head."""
        base = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)

        if freeze:
            for param in base.features.parameters():
                param.requires_grad = False

        # EfficientNet-B0 feature output: 1280-dim
        in_features = base.classifier[1].in_features
        base.classifier = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout * 0.5),
            nn.Linear(512, num_classes),
        )
        self.model = base

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)

    def unfreeze_top_layers(self, fraction: float = 0.3):
        """
        Unfreeze the top `fraction` of backbone layers for fine-tuning.
        
        Args:
            fraction: Fraction of layers to unfreeze (0.3 = top 30%).
        """
        if self.backbone_name == "mobilenetv2":
            features = list(self.model.features.children())
        elif self.backbone_name == "efficientnet_b0":
            features = list(self.model.features.children())
        else:
            return

        total = len(features)
        unfreeze_from = int(total * (1 - fraction))

        for i, layer in enumerate(features):
            if i >= unfreeze_from:
                for param in layer.parameters():
                    param.requires_grad = True

        frozen = sum(1 for p in self.model.features.parameters() if not p.requires_grad)
        total_params = sum(1 for _ in self.model.features.parameters())
        print(
            f"Unfroze top {fraction*100:.0f}% of backbone: "
            f"{total_params - frozen}/{total_params} params trainable"
        )

    def get_optimizer_param_groups(
        self, backbone_lr: float = 1e-4, head_lr: float = 1e-3
    ) -> list:
        """
        Return param groups with differential learning rates.
        
        Args:
            backbone_lr: Learning rate for the backbone (lower for fine-tuning).
            head_lr: Learning rate for the classifier head.
            
        Returns:
            List of param group dicts for torch.optim.
        """
        if self.backbone_name == "mobilenetv2":
            backbone_params = self.model.features.parameters()
            head_params = self.model.classifier.parameters()
        elif self.backbone_name == "efficientnet_b0":
            backbone_params = self.model.features.parameters()
            head_params = self.model.classifier.parameters()
        else:
            return [{"params": self.parameters(), "lr": head_lr}]

        return [
            {"params": backbone_params, "lr": backbone_lr},
            {"params": head_params, "lr": head_lr},
        ]

    def count_parameters(self) -> dict:
        """Count total, trainable, and frozen parameters."""
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {
            "total": total,
            "trainable": trainable,
            "frozen": total - trainable,
            "trainable_pct": f"{trainable / total * 100:.1f}%",
        }
