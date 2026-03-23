"""
Neural Network Models — ResNet variants for chess position evaluation.

Two architectures are available:

  ChessValueNetwork (v1):
    - Input: 18 x 8 x 8 (basic board encoding — pieces, castling, en passant, turn)
    - Plain residual blocks (conv -> BN -> ReLU -> conv -> BN -> skip)
    - Value head: conv 1x1 -> flatten -> FC -> tanh
    - Default: 4 blocks, 64 filters (~170K parameters)

  ChessValueNetworkV2:
    - Input: 26 x 8 x 8 (enhanced encoding — adds attacks, pawn structure,
      center control, king safety, material imbalance, mobility)
    - Squeeze-and-Excitation residual blocks (channel attention mechanism)
    - Global average pooling + dropout in value head
    - Default: 6 blocks, 128 filters (~1.3M parameters)

Both output a single value in [-1, 1]:
  -1 = black is winning,  0 = equal/draw,  +1 = white is winning

What is Squeeze-and-Excitation (SE)?
  After the two convolutions in a residual block, SE adds a "channel attention"
  step: it squeezes spatial info via global average pooling, then uses two small
  FC layers to learn which channels (feature maps) are most important for this
  particular position. This lets the network dynamically focus on relevant
  features — e.g., king safety features matter more in sharp positions,
  while pawn structure matters more in endgames.
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
    Small ResNet that evaluates chess positions (v1 architecture).

    Takes an 18x8x8 encoded board and outputs a value in [-1, 1]
    predicting the expected game outcome from white's perspective.
    """

    def __init__(self, num_blocks: int = 4, num_filters: int = 64,
                 input_planes: int = 18):
        super().__init__()

        # Initial convolution: expand from input planes to num_filters
        self.input_conv = nn.Sequential(
            nn.Conv2d(input_planes, num_filters, kernel_size=3, padding=1, bias=False),
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
            x: Tensor of shape (batch_size, input_planes, 8, 8)

        Returns:
            Tensor of shape (batch_size, 1) with values in [-1, 1]
        """
        out = self.input_conv(x)
        out = self.residual_blocks(out)
        value = self.value_head(out)
        return value


# ─── V2 Architecture: SE-ResNet ──────────────────────────────────────────────


class SEBlock(nn.Module):
    """
    Squeeze-and-Excitation block — learns per-channel attention weights.

    Given a feature map of shape (batch, channels, 8, 8):
      1. Squeeze: global average pool -> (batch, channels, 1, 1)
      2. Excite: FC -> ReLU -> FC -> Sigmoid -> per-channel weights
      3. Scale: multiply original feature map by these weights

    The reduction ratio controls the bottleneck size. With 128 channels
    and ratio 4, the bottleneck is 32 — keeps parameter count low while
    still learning useful channel relationships.
    """

    def __init__(self, channels: int, reduction: int = 4):
        super().__init__()
        mid = max(channels // reduction, 8)
        self.squeeze = nn.AdaptiveAvgPool2d(1)
        self.excite = nn.Sequential(
            nn.Linear(channels, mid, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(mid, channels, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x):
        b, c, _, _ = x.shape
        w = self.squeeze(x).view(b, c)
        w = self.excite(w).view(b, c, 1, 1)
        return x * w


class SEResidualBlock(nn.Module):
    """
    Residual block with Squeeze-and-Excitation attention.

    Input -> Conv -> BN -> ReLU -> Conv -> BN -> SE -> (+input) -> ReLU

    The SE block is applied before the skip connection, so it learns
    to reweight the residual's feature channels.
    """

    def __init__(self, channels: int, se_reduction: int = 4):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.se = SEBlock(channels, se_reduction)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.se(out)       # Channel attention
        out = out + residual     # Skip connection
        out = self.relu(out)
        return out


class ChessValueNetworkV2(nn.Module):
    """
    Enhanced SE-ResNet for chess evaluation (v2 architecture).

    Improvements over v1:
      - SE blocks for channel attention (learns which features matter)
      - Supports 26-plane enhanced encoding (attacks, pawn structure, etc.)
      - Global average pooling in value head (more parameter-efficient)
      - Dropout for regularization
      - Larger default architecture (6 blocks, 128 filters)
    """

    def __init__(self, num_blocks: int = 6, num_filters: int = 128,
                 input_planes: int = 26, se_reduction: int = 4,
                 dropout: float = 0.1):
        super().__init__()
        self.input_planes = input_planes

        # Initial convolution
        self.input_conv = nn.Sequential(
            nn.Conv2d(input_planes, num_filters, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(num_filters),
            nn.ReLU(inplace=True),
        )

        # Stack of SE residual blocks
        self.residual_blocks = nn.Sequential(
            *[SEResidualBlock(num_filters, se_reduction) for _ in range(num_blocks)]
        )

        # Value head with global average pooling
        self.value_head = nn.Sequential(
            nn.Conv2d(num_filters, 32, kernel_size=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d(1),    # (batch, 32, 1, 1)
            nn.Flatten(),               # (batch, 32)
            nn.Linear(32, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(128, 1),
            nn.Tanh(),
        )

    def forward(self, x):
        out = self.input_conv(x)
        out = self.residual_blocks(out)
        value = self.value_head(out)
        return value
