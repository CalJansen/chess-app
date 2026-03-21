"""
Train with Stockfish Supervision — Use Stockfish evaluations as training labels.

This is the single highest-impact improvement for the neural network. Instead of
labeling positions with the binary game outcome (+1/-1/0), we label each position
with Stockfish's centipawn evaluation, normalized to [-1, 1] via tanh(cp/300).

Why this is better:
  - Game outcomes are noisy: a player might have a winning position but blunder
    later, labeling all earlier positions as "losing". Stockfish evaluates each
    position independently and accurately.

  - The training signal is much denser: instead of just three values (-1, 0, +1),
    every position gets a precise evaluation (e.g., +0.35 for a slight White edge,
    -0.72 for a significant Black advantage).

  - The normalization tanh(cp/300) maps centipawn scores to [-1, 1]:
      0 cp   -> 0.0    (equal)
      150 cp -> 0.46   (slight advantage)
      300 cp -> 0.76   (clear advantage)
      600 cp -> 0.96   (winning)
      mate   -> ~1.0   (decisive)

Pipeline:
  Phase 1: Extract positions from Lichess PGN games
  Phase 2: Label each position with Stockfish evaluation
  Phase 3: Train the same ResNet architecture with the better labels

Usage:
    # Full pipeline: extract, label with Stockfish, and train
    python -m training.train_stockfish --max-games 5000 --depth 12

    # Reuse previously cached labeled data (skip Stockfish labeling)
    python -m training.train_stockfish --labeled-data data/sf_training_data.pt

    # Custom output model name
    python -m training.train_stockfish --max-games 10000 --output models/chess_value_sf_v2.pt
"""

import argparse
import math
import os
import sys
import time
import random
import numpy as np
import torch
import chess
import chess.pgn

from training.board_encoding import encode_board
from training.prepare_dataset import parse_pgn_games
from training.train import train_model

# Resolve paths relative to the backend root
_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(_BACKEND_DIR, "data")
MODELS_DIR = os.path.join(_BACKEND_DIR, "models")


def _find_stockfish_binary() -> str | None:
    """Find the Stockfish binary in the stockfish/ directory."""
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
    """
    Normalize a centipawn score to [-1, 1] using tanh.

    The scale parameter controls the mapping:
      - scale=300: a 3-pawn advantage maps to ~0.76
      - This matches conventions used by Leela Chess Zero and other engines.
    """
    return math.tanh(cp / scale)


# ─── Phase 1: Extract positions from PGN ─────────────────────────────────────

def extract_positions(pgn_path: str, max_games: int = 5000,
                      sample_rate: float = 0.25) -> list[tuple[str, np.ndarray]]:
    """
    Extract positions from a PGN file.

    Returns list of (fen, encoded_board) tuples. The FEN is needed for
    Stockfish evaluation; the encoded board is the training input tensor.
    """
    print(f"\n{'='*60}")
    print(f"Phase 1: Extracting positions from PGN")
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
            # Skip early opening positions (first 5 full moves)
            if board.fullmove_number <= 5:
                continue
            # Skip game-over positions (Stockfish can't evaluate these)
            if board.is_game_over(claim_draw=True):
                continue
            # Random sampling
            if rng.random() < sample_rate:
                fen = board.fen()
                encoded = encode_board(board)
                positions.append((fen, encoded))

        games_processed += 1
        if games_processed % 2000 == 0:
            print(f"  Processed {games_processed} games, {len(positions)} positions...")

    print(f"  Total: {games_processed} games, {len(positions)} positions extracted")
    return positions


# ─── Phase 2: Label positions with Stockfish ──────────────────────────────────

def label_positions(positions: list[tuple[str, np.ndarray]],
                    depth: int = 12, scale: int = 300) -> tuple[np.ndarray, np.ndarray]:
    """
    Evaluate each position with Stockfish and create labeled training data.

    Returns (inputs, targets) numpy arrays ready for training.
    """
    print(f"\n{'='*60}")
    print(f"Phase 2: Labeling positions with Stockfish (depth={depth})")
    print(f"{'='*60}")

    binary_path = _find_stockfish_binary()
    if binary_path is None:
        print("ERROR: Stockfish binary not found in backend/stockfish/")
        print("Download from https://stockfishchess.org/download/")
        sys.exit(1)

    # Import and create a dedicated Stockfish process for labeling
    # (not the module-level singleton from stockfish_eval.py)
    from engines.stockfish_eval import StockfishProcess
    engine = StockfishProcess(binary_path)
    print(f"  Stockfish loaded: {binary_path}")
    print(f"  Positions to label: {len(positions)}")
    print(f"  Normalization: tanh(cp/{scale})")

    inputs = []
    targets = []
    errors = 0
    start_time = time.time()

    for i, (fen, encoded) in enumerate(positions):
        result = engine.evaluate(fen, depth=depth)
        if result is None:
            errors += 1
            continue

        # result['score_cp'] is already normalized to White's perspective
        label = normalize_cp(result["score_cp"], scale)
        inputs.append(encoded)
        targets.append(label)

        # Progress reporting
        if (i + 1) % 1000 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            eta = (len(positions) - i - 1) / rate if rate > 0 else 0
            print(f"  Labeled {i+1}/{len(positions)} "
                  f"({rate:.0f} pos/s, ETA: {eta/60:.1f}min, errors: {errors})")

    engine.quit()

    elapsed = time.time() - start_time
    print(f"\n  Labeling complete: {len(inputs)} positions in {elapsed:.1f}s "
          f"({len(inputs)/elapsed:.0f} pos/s)")
    if errors > 0:
        print(f"  Skipped {errors} positions due to Stockfish errors")

    # Show label distribution
    targets_arr = np.array(targets, dtype=np.float32)
    print(f"\n  Label statistics:")
    print(f"    Mean:   {targets_arr.mean():.4f}")
    print(f"    Std:    {targets_arr.std():.4f}")
    print(f"    Min:    {targets_arr.min():.4f}")
    print(f"    Max:    {targets_arr.max():.4f}")
    print(f"    |label| > 0.9 (decisive): {(np.abs(targets_arr) > 0.9).sum()} "
          f"({(np.abs(targets_arr) > 0.9).mean()*100:.1f}%)")

    return np.stack(inputs), targets_arr


# ─── Phase 3: Save labeled data and train ─────────────────────────────────────

def save_labeled_data(inputs: np.ndarray, targets: np.ndarray, path: str):
    """Save labeled dataset as a .pt file for reuse."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    inputs_tensor = torch.from_numpy(inputs)  # (N, 18, 8, 8)
    targets_tensor = torch.from_numpy(targets).unsqueeze(1)  # (N, 1)
    torch.save({"inputs": inputs_tensor, "targets": targets_tensor}, path)
    file_size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"\n  Labeled data saved: {path} ({file_size_mb:.1f} MB)")
    print(f"  Shape: inputs={list(inputs_tensor.shape)}, targets={list(targets_tensor.shape)}")


def main():
    parser = argparse.ArgumentParser(
        description="Train chess value network with Stockfish-supervised labels",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full pipeline with defaults
  python -m training.train_stockfish

  # More games, deeper Stockfish analysis
  python -m training.train_stockfish --max-games 10000 --depth 15

  # Reuse cached labeled data (skip Stockfish labeling)
  python -m training.train_stockfish --labeled-data data/sf_training_data.pt

  # Train with different hyperparameters
  python -m training.train_stockfish --labeled-data data/sf_training_data.pt \\
      --lr 0.0003 --epochs 80 --output models/chess_value_sf_v2.pt
        """)

    # Data source
    parser.add_argument("--pgn", default=os.path.join(DATA_DIR, "lichess_games.pgn"),
                        help="Input PGN file (default: data/lichess_games.pgn)")
    parser.add_argument("--labeled-data", default=None,
                        help="Pre-labeled .pt file (skip PGN + Stockfish phases)")
    parser.add_argument("--max-games", type=int, default=5000,
                        help="Max PGN games to extract positions from (default: 5000)")
    parser.add_argument("--sample-rate", type=float, default=0.25,
                        help="Fraction of positions to sample per game (default: 0.25)")

    # Stockfish settings
    parser.add_argument("--depth", type=int, default=12,
                        help="Stockfish search depth for labeling (default: 12)")
    parser.add_argument("--scale", type=int, default=300,
                        help="Normalization scale: tanh(cp/scale) (default: 300)")

    # Training settings
    parser.add_argument("--output", default=os.path.join(MODELS_DIR, "chess_value_sf_v1.pt"),
                        help="Output model file (default: models/chess_value_sf_v1.pt)")
    parser.add_argument("--epochs", type=int, default=50,
                        help="Max training epochs (default: 50)")
    parser.add_argument("--batch-size", type=int, default=256,
                        help="Training batch size (default: 256)")
    parser.add_argument("--lr", type=float, default=0.0005,
                        help="Learning rate (default: 0.0005, lower than game-outcome training)")
    parser.add_argument("--blocks", type=int, default=4,
                        help="ResNet residual blocks (default: 4)")
    parser.add_argument("--filters", type=int, default=64,
                        help="Convolutional filters (default: 64)")
    parser.add_argument("--patience", type=int, default=7,
                        help="Early stopping patience (default: 7)")

    # Cache
    parser.add_argument("--save-labeled", default=os.path.join(DATA_DIR, "sf_training_data.pt"),
                        help="Save labeled data here for reuse (default: data/sf_training_data.pt)")

    args = parser.parse_args()

    print("Stockfish-Supervised Training Pipeline")
    print("=" * 60)

    labeled_data_path = args.save_labeled

    if args.labeled_data and os.path.exists(args.labeled_data):
        # Skip phases 1 & 2 — use cached labeled data
        labeled_data_path = args.labeled_data
        print(f"Using pre-labeled data: {labeled_data_path}")
    else:
        # Phase 1: Extract positions
        if not os.path.exists(args.pgn):
            print(f"ERROR: PGN file not found: {args.pgn}")
            print("Run first: python -m training.download_data")
            sys.exit(1)

        positions = extract_positions(args.pgn, args.max_games, args.sample_rate)

        if not positions:
            print("ERROR: No positions extracted. Check the PGN file.")
            sys.exit(1)

        # Phase 2: Label with Stockfish
        inputs, targets = label_positions(positions, args.depth, args.scale)

        # Save labeled data for reuse
        save_labeled_data(inputs, targets, labeled_data_path)

        # Free memory
        del positions

    # Phase 3: Train
    print(f"\n{'='*60}")
    print(f"Phase 3: Training neural network")
    print(f"{'='*60}")
    print(f"  Data:      {labeled_data_path}")
    print(f"  Output:    {args.output}")
    print(f"  Epochs:    {args.epochs}")
    print(f"  Batch:     {args.batch_size}")
    print(f"  LR:        {args.lr}")
    print(f"  Arch:      {args.blocks} blocks, {args.filters} filters")
    print(f"  Patience:  {args.patience}")

    train_model(
        data_path=labeled_data_path,
        output_path=args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        num_blocks=args.blocks,
        num_filters=args.filters,
        patience=args.patience,
    )

    print(f"\nDone! The model will appear as 'nn-{os.path.splitext(os.path.basename(args.output))[0]}' "
          f"in the engine selector.")
    print("Run a tournament to compare: python -m training.tournament --engines nn-chess_value_sf_v1 minimax-d3")


if __name__ == "__main__":
    main()
