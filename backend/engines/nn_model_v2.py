"""
Neural Network Model V2 — SE-ResNet for chess position evaluation.

Enhancements over V1:
  - Squeeze-and-Excitation (SE) blocks for channel attention
  - 26-plane input encoding (attack maps, pawn structure, king zone, clocks)
  - Larger value head with dropout for regularization
  - Configurable SE reduction ratio

Architecture:
  - Input: 26 x 8 x 8 (enhanced board encoding)
  - Initial conv: 26 -> num_filters, 3x3, padding=1
  - N SE-ResNet blocks: conv + BN + ReLU + conv + BN + SE + skip
  - Value head: Conv 1x1 -> BN -> ReLU -> Flatten -> Dropout ->
                FC -> ReLU -> Dropout -> FC -> Tanh
"""

import torch
import torch.nn as nn


class SqueezeExcitation(nn.Module):
    """
    Squeeze-and-Excitation block for channel attention.

    Learns to weight channels by their importance:
      1. Squeeze: Global average pooling reduces spatial dims to 1x1
      2. Excitation: Two FC layers learn channel weights
      3. Scale: Multiply input channels by learned weights

    This lets the network emphasize important features (e.g., king safety
    planes) and suppress less relevant ones for a given position.
    """

    def __init__(self, channels: int, reduction: int = 4):
        super().__init__()
        self.squeeze = nn.AdaptiveAvgPool2d(1)
        self.excite = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x):
        b, c, _, _ = x.shape
        # Squeeze: (B, C, H, W) -> (B, C)
        scale = self.squeeze(x).view(b, c)
        # Excitation: (B, C) -> (B, C)
        scale = self.excite(scale).view(b, c, 1, 1)
        # Scale: element-wise multiply
        return x * scale


class SEResidualBlock(nn.Module):
    """
    Residual block with Squeeze-and-Excitation attention.

    Input -> Conv -> BN -> ReLU -> Conv -> BN -> SE -> (+input) -> ReLU
    """

    def __init__(self, channels: int, se_reduction: int = 4):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.se = SqueezeExcitation(channels, se_reduction)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.se(out)
        out = out + residual
        out = self.relu(out)
        return out


class ChessValueNetworkV2(nn.Module):
    """
    SE-ResNet that evaluates chess positions.

    Takes a 26x8x8 encoded board and outputs a value in [-1, 1]
    predicting the expected game outcome from white's perspective.
    """

    def __init__(
        self,
        input_planes: int = 26,
        num_blocks: int = 6,
        num_filters: int = 128,
        se_reduction: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()

        # Initial convolution: expand from input_planes to num_filters
        self.input_conv = nn.Sequential(
            nn.Conv2d(input_planes, num_filters, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(num_filters),
            nn.ReLU(inplace=True),
        )

        # Stack of SE-Residual blocks
        self.residual_blocks = nn.Sequential(
            *[SEResidualBlock(num_filters, se_reduction) for _ in range(num_blocks)]
        )

        # Value head with dropout and global average pooling
        value_channels = num_filters // 4  # 128 -> 32
        self.value_head = nn.Sequential(
            nn.Conv2d(num_filters, value_channels, kernel_size=1, bias=False),  # 0
            nn.BatchNorm2d(value_channels),                                     # 1
            nn.ReLU(inplace=True),                                              # 2
            nn.AdaptiveAvgPool2d(1),                                            # 3
            nn.Flatten(),                                                       # 4 -> (B, value_channels)
            nn.Linear(value_channels, num_filters),                             # 5
            nn.ReLU(inplace=True),                                              # 6
            nn.Dropout(dropout),                                                # 7
            nn.Linear(num_filters, 1),                                          # 8
            nn.Tanh(),                                                          # 9
        )

    def forward(self, x):
        out = self.input_conv(x)
        out = self.residual_blocks(out)
        value = self.value_head(out)
        return value
