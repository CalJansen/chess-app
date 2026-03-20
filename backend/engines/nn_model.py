"""
Neural Network Model — Small ResNet for chess position evaluation.

Architecture:
  - Input: 18 x 8 x 8 (board encoding)
  - Initial conv: 18 -> 64 filters, 3x3, padding=1
  - 4 residual blocks: each has 2 conv layers with batch norm and ReLU
  - Value head: global average pooling -> FC 64 -> ReLU -> FC 1 -> tanh

The output is a single value in [-1, 1]:
  -1 = black is winning
   0 = equal / draw
  +1 = white is winning

This is a "value network" — it learns to predict game outcomes from
board positions, similar to how AlphaGo/AlphaZero evaluates positions.

Why ResNet?
  Residual connections let gradients flow through deeper networks without
  vanishing. Even with just 4 blocks, this helps the network learn more
  complex positional patterns than a plain CNN could.
"""

import torch
import torch.nn as nn


class ResidualBlock(nn.Module):
    """
    A single residual block: two convolutions with a skip connection.

    Input -> Conv -> BN -> ReLU -> Conv -> BN -> (+input) -> ReLU -> Output

    The skip connection (adding the input back) is the key insight of ResNets.
    It lets the block learn "what to add" to the existing representation,
    rather than learning the full transformation from scratch.
    """

    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = out + residual  # Skip connection
        out = self.relu(out)
        return out


class ChessValueNetwork(nn.Module):
    """
    Small ResNet that evaluates chess positions.

    Takes an 18x8x8 encoded board and outputs a value in [-1, 1]
    predicting the expected game outcome from white's perspective.
    """

    def __init__(self, num_blocks: int = 4, num_filters: int = 64):
        super().__init__()

        # Initial convolution: expand from 18 input planes to num_filters
        self.input_conv = nn.Sequential(
            nn.Conv2d(18, num_filters, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(num_filters),
            nn.ReLU(inplace=True),
        )

        # Stack of residual blocks
        self.residual_blocks = nn.Sequential(
            *[ResidualBlock(num_filters) for _ in range(num_blocks)]
        )

        # Value head: reduce to a single scalar
        self.value_head = nn.Sequential(
            nn.Conv2d(num_filters, 1, kernel_size=1, bias=False),  # 1 filter
            nn.BatchNorm2d(1),
            nn.ReLU(inplace=True),
            nn.Flatten(),           # 1 x 8 x 8 -> 64
            nn.Linear(64, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
            nn.Tanh(),              # Output in [-1, 1]
        )

    def forward(self, x):
        """
        Forward pass.

        Args:
            x: Tensor of shape (batch_size, 18, 8, 8)

        Returns:
            Tensor of shape (batch_size, 1) with values in [-1, 1]
        """
        out = self.input_conv(x)
        out = self.residual_blocks(out)
        value = self.value_head(out)
        return value
