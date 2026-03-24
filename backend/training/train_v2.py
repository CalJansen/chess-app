"""
Train V2 — Stockfish-supervised training with enhanced architecture.

Combines the improvements from Phase 9A (Stockfish labels) with Phase 9B-D:
  - Enhanced 26-plane board encoding (attacks, pawn structure, king safety, etc.)
  - SE-ResNet architecture (Squeeze-and-Excitation channel attention)
  - Data augmentation via board mirroring (doubles effective dataset size)
  - Saves v2 architecture metadata so the engine auto-detects the correct model

This script follows the same 3-phase pipeline as train_stockfish.py:
  Phase 1: Extract positions from PGN
  Phase 2: Label with Stockfish (or reuse cached labels)
  Phase 3: Train the v2 model

Usage:
    # Full pipeline
    python -m training.train_v2 --max-games 5000 --depth 12

    # Reuse Stockfish labels from a previous run
    python -m training.train_v2 --labeled-data data/sf_v2_training_data.pt

    # Compare with v1: run a tournament after training
    python -m training.tournament --engines nn-chess_value_v2 nn-chess_value_sf_v1 minimax-d3
"""

import argparse
import math
import os
import sys
import time
import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split
import chess

from training.board_encoding_v2 import encode_board_v2, NUM_PLANES_V2
from training.prepare_dataset import parse_pgn_games
from engines.nn_model import ChessValueNetworkV2

# Resolve paths
_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(_BACKEND_DIR, "data")
MODELS_DIR = os.path.join(_BACKEND_DIR, "models")


def _find_stockfish_binary() -> str | None:
    """Find the Stockfish binary."""
    import glob as _glob
    stockfish_dir = os.path.join(_BACKEND_DIR, "stockfish")
    if not os.path.isdir(stockfish_dir):
        return None
    for pattern in [os.path.join(stockfish_dir, "*.exe"),
                    os.path.join(stockfish_dir, "stockfish*")]:
        matches = _glob.glob(pattern)
        if matches:
            return os.path.abspath(matches[0])
    return None


def normalize_cp(cp: int, scale: int = 300) -> float:
    return math.tanh(cp / scale)


# ─── Phase 1: Extract positions with v2 encoding ─────────────────────────────

def extract_positions(pgn_path: str, max_games: int = 5000,
                      sample_rate: float = 0.25) -> list[tuple[str, np.ndarray]]:
    """Extract positions using the enhanced v2 board encoding."""
    print(f"\n{'='*60}")
    print(f"Phase 1: Extracting positions (v2 encoding, {NUM_PLANES_V2} planes)")
    print(f"{'='*60}")
    print(f"  PGN file:    {pgn_path}")
    print(f"  Max games:   {max_games}")
    print(f"  Sample rate: {sample_rate}")

    positions = []
    games_processed = 0
    rng = random.Random(42)

    for game in parse_pgn_games(pgn_path, max_games):
        board = game.board()
        for move in game.mainline_moves():
            board.push(move)
            if board.fullmove_number <= 5:
                continue
            if board.is_game_over(claim_draw=True):
                continue
            if rng.random() < sample_rate:
                fen = board.fen()
                encoded = encode_board_v2(board)
                positions.append((fen, encoded))

        games_processed += 1
        if games_processed % 2000 == 0:
            print(f"  Processed {games_processed} games, {len(positions)} positions...")

    print(f"  Total: {games_processed} games, {len(positions)} positions extracted")
    return positions


# ─── Phase 2: Label with Stockfish ───────────────────────────────────────────

def label_positions(positions: list[tuple[str, np.ndarray]],
                    depth: int = 12, scale: int = 300) -> tuple[np.ndarray, np.ndarray]:
    """Evaluate each position with Stockfish."""
    print(f"\n{'='*60}")
    print(f"Phase 2: Labeling positions with Stockfish (depth={depth})")
    print(f"{'='*60}")

    binary_path = _find_stockfish_binary()
    if binary_path is None:
        print("ERROR: Stockfish binary not found in backend/stockfish/")
        sys.exit(1)

    from engines.stockfish_eval import StockfishProcess
    engine = StockfishProcess(binary_path)
    print(f"  Stockfish loaded: {binary_path}")
    print(f"  Positions to label: {len(positions)}")

    inputs = []
    targets = []
    errors = 0
    start_time = time.time()

    for i, (fen, encoded) in enumerate(positions):
        result = engine.evaluate(fen, depth=depth)
        if result is None:
            errors += 1
            continue

        label = normalize_cp(result["score_cp"], scale)
        inputs.append(encoded)
        targets.append(label)

        if (i + 1) % 1000 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            eta = (len(positions) - i - 1) / rate if rate > 0 else 0
            print(f"  Labeled {i+1}/{len(positions)} "
                  f"({rate:.0f} pos/s, ETA: {eta/60:.1f}min)")

    engine.quit()

    elapsed = time.time() - start_time
    print(f"\n  Labeling complete: {len(inputs)} positions in {elapsed:.1f}s")
    if errors > 0:
        print(f"  Skipped {errors} positions due to errors")

    targets_arr = np.array(targets, dtype=np.float32)
    print(f"  Label stats: mean={targets_arr.mean():.4f}, std={targets_arr.std():.4f}")

    return np.stack(inputs), targets_arr


# ─── Data augmentation ────────────────────────────────────────────────────────

def augment_mirror(inputs: torch.Tensor, targets: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Data augmentation: mirror the board horizontally (flip files a<->h).

    Chess is symmetric along the a-h axis — a position mirrored left-to-right
    has the same evaluation. This effectively doubles the training data for free.

    We flip the last dimension (file axis) of the 8x8 board planes.
    The targets stay the same since mirroring doesn't change who's winning.
    """
    mirrored = inputs.flip(-1)  # Flip the file dimension
    aug_inputs = torch.cat([inputs, mirrored], dim=0)
    aug_targets = torch.cat([targets, targets], dim=0)
    print(f"  Data augmentation: {len(inputs)} -> {len(aug_inputs)} positions (horizontal mirror)")
    return aug_inputs, aug_targets


# ─── Phase 3: Train V2 model ─────────────────────────────────────────────────

def train_v2_model(data_path: str, output_path: str, epochs: int = 50,
                   batch_size: int = 256, learning_rate: float = 0.0005,
                   num_blocks: int = 6, num_filters: int = 128,
                   patience: int = 7, dropout: float = 0.1,
                   use_augmentation: bool = True):
    """Train the V2 chess value network."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Load data
    print(f"Loading dataset from: {data_path}")
    data = torch.load(data_path, weights_only=True)
    inputs = data["inputs"]   # (N, 26, 8, 8)
    targets = data["targets"]  # (N, 1)
    print(f"  Total positions: {len(inputs)}")
    print(f"  Input planes: {inputs.shape[1]}")

    # Data augmentation
    if use_augmentation:
        inputs, targets = augment_mirror(inputs, targets)

    # Train/validation split (90/10)
    dataset = TensorDataset(inputs, targets)
    val_size = max(1, len(dataset) // 10)
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    print(f"  Train: {train_size}, Validation: {val_size}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    # Create V2 model
    input_planes = inputs.shape[1]
    model = ChessValueNetworkV2(
        num_blocks=num_blocks, num_filters=num_filters,
        input_planes=input_planes, dropout=dropout,
    ).to(device)
    param_count = sum(p.numel() for p in model.parameters())
    print(f"  V2 Model: {num_blocks} SE-ResNet blocks, {num_filters} filters, {param_count:,} parameters")

    # Loss, optimizer, scheduler
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=2
    )

    # Training loop
    best_val_loss = float("inf")
    epochs_without_improvement = 0
    best_state = None

    print(f"\nTraining for up to {epochs} epochs (patience={patience})...\n")

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        # ── Train ──
        model.train()
        train_loss = 0.0
        train_batches = 0

        for batch_inputs, batch_targets in train_loader:
            batch_inputs = batch_inputs.to(device)
            batch_targets = batch_targets.to(device)

            optimizer.zero_grad()
            predictions = model(batch_inputs)
            loss = criterion(predictions, batch_targets)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            train_batches += 1

        avg_train_loss = train_loss / train_batches

        # ── Validate ──
        model.eval()
        val_loss = 0.0
        val_batches = 0

        with torch.no_grad():
            for batch_inputs, batch_targets in val_loader:
                batch_inputs = batch_inputs.to(device)
                batch_targets = batch_targets.to(device)
                predictions = model(batch_inputs)
                loss = criterion(predictions, batch_targets)
                val_loss += loss.item()
                val_batches += 1

        avg_val_loss = val_loss / val_batches
        scheduler.step(avg_val_loss)

        elapsed = time.time() - epoch_start
        current_lr = optimizer.param_groups[0]["lr"]

        improved = ""
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            epochs_without_improvement = 0
            improved = " *"
        else:
            epochs_without_improvement += 1

        print(
            f"  Epoch {epoch:3d}/{epochs} | "
            f"train_loss={avg_train_loss:.6f} | "
            f"val_loss={avg_val_loss:.6f} | "
            f"lr={current_lr:.6f} | "
            f"{elapsed:.1f}s{improved}"
        )

        if epochs_without_improvement >= patience:
            print(f"\n  Early stopping: no improvement for {patience} epochs")
            break

    # Save model with v2 metadata
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    save_dict = {
        "model_state_dict": best_state,
        "architecture": "v2",
        "input_planes": input_planes,
        "num_blocks": num_blocks,
        "num_filters": num_filters,
        "se_reduction": 4,
        "dropout": dropout,
        "best_val_loss": best_val_loss,
        "train_positions": train_size,
    }
    torch.save(save_dict, output_path)

    print(f"\nModel saved to: {output_path}")
    print(f"  Architecture: SE-ResNet v2 ({num_blocks} blocks, {num_filters} filters)")
    print(f"  Best validation loss: {best_val_loss:.6f}")
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  File size: {file_size_mb:.1f} MB")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def save_labeled_data(inputs: np.ndarray, targets: np.ndarray, path: str):
    """Save labeled dataset as .pt file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    inputs_tensor = torch.from_numpy(inputs)
    targets_tensor = torch.from_numpy(targets).unsqueeze(1)
    torch.save({"inputs": inputs_tensor, "targets": targets_tensor}, path)
    file_size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"\n  Labeled data saved: {path} ({file_size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(
        description="Train V2 chess network (SE-ResNet + enhanced encoding)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full pipeline
  python -m training.train_v2 --max-games 5000 --depth 12

  # Reuse cached Stockfish labels
  python -m training.train_v2 --labeled-data data/sf_v2_training_data.pt

  # Larger architecture
  python -m training.train_v2 --labeled-data data/sf_v2_training_data.pt \\
      --blocks 8 --filters 128 --output models/chess_value_v2_large.pt
        """)

    # Data source
    parser.add_argument("--pgn", default=os.path.join(DATA_DIR, "lichess_games.pgn"))
    parser.add_argument("--labeled-data", default=None,
                        help="Pre-labeled .pt file (skip extraction + Stockfish). "
                             "If not specified, auto-detects cached data at --save-labeled path.")
    parser.add_argument("--fresh-data", action="store_true",
                        help="Force re-extraction and re-labeling even if cached data exists")
    parser.add_argument("--max-games", type=int, default=5000)
    parser.add_argument("--sample-rate", type=float, default=0.25)

    # Stockfish
    parser.add_argument("--depth", type=int, default=12)
    parser.add_argument("--scale", type=int, default=300)

    # Training
    parser.add_argument("--output", default=os.path.join(MODELS_DIR, "chess_value_v2.pt"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=0.0005)
    parser.add_argument("--blocks", type=int, default=6, help="SE-ResNet blocks (default: 6)")
    parser.add_argument("--filters", type=int, default=128, help="Conv filters (default: 128)")
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--patience", type=int, default=7)
    parser.add_argument("--no-augmentation", action="store_true",
                        help="Disable horizontal mirror augmentation")

    # Cache
    parser.add_argument("--save-labeled", default=os.path.join(DATA_DIR, "sf_v2_training_data.pt"))

    args = parser.parse_args()

    print("V2 Stockfish-Supervised Training Pipeline")
    print("=" * 60)
    print(f"  Architecture: SE-ResNet v2 ({args.blocks} blocks, {args.filters} filters)")
    print(f"  Encoding:     {NUM_PLANES_V2} planes (enhanced)")

    labeled_data_path = args.save_labeled

    # Determine whether to use cached labeled data:
    # 1. Explicit --labeled-data path always wins
    # 2. Auto-detect cached data at --save-labeled path (unless --fresh-data)
    # 3. Fall back to full pipeline (extract + label)
    use_cached = False
    if args.labeled_data and os.path.exists(args.labeled_data):
        labeled_data_path = args.labeled_data
        use_cached = True
        print(f"\n  Using pre-labeled data: {labeled_data_path}")
    elif not args.fresh_data and os.path.exists(args.save_labeled):
        use_cached = True
        print(f"\n  Found cached labeled data: {labeled_data_path}")
        print(f"  (use --fresh-data to force re-extraction and re-labeling)")

    if not use_cached:
        if not args.fresh_data and not os.path.exists(args.save_labeled):
            print(f"\n  No cached data found at {args.save_labeled}")
            print(f"  Running full pipeline (extract + label)...")

        if not os.path.exists(args.pgn):
            print(f"ERROR: PGN file not found: {args.pgn}")
            print("Run first: python -m training.download_data")
            sys.exit(1)

        positions = extract_positions(args.pgn, args.max_games, args.sample_rate)
        if not positions:
            print("ERROR: No positions extracted.")
            sys.exit(1)

        inputs, targets = label_positions(positions, args.depth, args.scale)
        save_labeled_data(inputs, targets, labeled_data_path)
        del positions

    # Phase 3: Train
    print(f"\n{'='*60}")
    print(f"Phase 3: Training V2 model")
    print(f"{'='*60}")

    train_v2_model(
        data_path=labeled_data_path,
        output_path=args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        num_blocks=args.blocks,
        num_filters=args.filters,
        patience=args.patience,
        dropout=args.dropout,
        use_augmentation=not args.no_augmentation,
    )

    model_name = os.path.splitext(os.path.basename(args.output))[0]
    print(f"\nDone! The model will appear as 'nn-{model_name}' in the engine selector.")
    print(f"Compare with v1: python -m training.tournament --engines nn-{model_name} nn-chess_value_sf_v1 minimax-d3")


if __name__ == "__main__":
    main()
