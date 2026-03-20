"""
Prepare Dataset — Parse PGN games into training tensors.

Reads a PGN file, replays each game, encodes every board position, and
labels it with the game result. Saves the result as a PyTorch .pt file
containing input tensors (board encodings) and target tensors (game outcomes).

This is supervised learning: we're teaching the network "given this position,
what was the actual game result?" Over many positions, the network learns
to recognize patterns that correlate with winning or losing.

Usage:
    python -m training.prepare_dataset --input data/lichess_games.pgn --output data/training_data.pt
"""

import argparse
import os
import time
import numpy as np
import torch
import chess
import chess.pgn
import io

from training.board_encoding import encode_board

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


RESULT_MAP = {
    "1-0": 1.0,    # White wins
    "0-1": -1.0,   # Black wins
    "1/2-1/2": 0.0,  # Draw
}


def parse_pgn_games(pgn_path: str, max_games: int = None):
    """
    Generator that yields chess.pgn.Game objects from a PGN file.

    Skips games with no moves or unknown results.
    """
    games_read = 0
    with open(pgn_path, "r", encoding="utf-8", errors="replace") as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            result = game.headers.get("Result", "*")
            if result not in RESULT_MAP:
                continue
            if game.end() == game:  # No moves
                continue
            games_read += 1
            if max_games and games_read > max_games:
                break
            yield game

    print(f"  Read {games_read} valid games from {pgn_path}")


def game_to_positions(game, sample_rate: float = 0.25):
    """
    Extract (board_encoding, result) pairs from a single game.

    We don't use every position — that would create too much redundant data
    (opening positions appear thousands of times). Instead we randomly sample
    a fraction of positions from each game.

    Args:
        game: A chess.pgn.Game object
        sample_rate: Fraction of positions to keep (0.25 = ~25%)

    Returns:
        List of (encoded_board, result_value) tuples
    """
    result = RESULT_MAP[game.headers["Result"]]
    positions = []

    board = game.board()
    rng = np.random.default_rng()

    for move in game.mainline_moves():
        board.push(move)
        # Skip very early positions (first 5 full moves) — openings are
        # memorized, not "evaluated", so they add noise to training
        if board.fullmove_number <= 5:
            continue
        # Random sampling to reduce dataset size and redundancy
        if rng.random() < sample_rate:
            encoded = encode_board(board)
            positions.append((encoded, result))

    return positions


def prepare_dataset(pgn_path: str, output_path: str, max_games: int = None,
                    sample_rate: float = 0.25):
    """
    Process PGN file into training tensors and save as .pt file.

    The output file contains:
        - "inputs": Float tensor of shape (N, 18, 8, 8)
        - "targets": Float tensor of shape (N, 1)

    where N is the total number of sampled positions.
    """
    print(f"Preparing dataset from: {pgn_path}")
    start_time = time.time()

    all_inputs = []
    all_targets = []
    games_processed = 0

    for game in parse_pgn_games(pgn_path, max_games):
        positions = game_to_positions(game, sample_rate)
        for board_enc, result_val in positions:
            all_inputs.append(board_enc)
            all_targets.append(result_val)
        games_processed += 1
        if games_processed % 5000 == 0:
            print(f"  Processed {games_processed} games, {len(all_inputs)} positions so far...")

    if not all_inputs:
        print("Error: No positions extracted. Check the PGN file.")
        return

    # Stack into tensors
    inputs_tensor = torch.from_numpy(np.stack(all_inputs))   # (N, 18, 8, 8)
    targets_tensor = torch.tensor(all_targets, dtype=torch.float32).unsqueeze(1)  # (N, 1)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    torch.save({"inputs": inputs_tensor, "targets": targets_tensor}, output_path)

    elapsed = time.time() - start_time
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nDataset saved to: {output_path}")
    print(f"  Games processed: {games_processed}")
    print(f"  Total positions: {len(all_inputs)}")
    print(f"  Tensor shape: inputs={list(inputs_tensor.shape)}, targets={list(targets_tensor.shape)}")
    print(f"  File size: {file_size_mb:.1f} MB")
    print(f"  Time: {elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(description="Prepare training dataset from PGN")
    parser.add_argument("--input", default=os.path.join(DATA_DIR, "lichess_games.pgn"),
                        help="Input PGN file")
    parser.add_argument("--output", default=os.path.join(DATA_DIR, "training_data.pt"),
                        help="Output .pt file")
    parser.add_argument("--max-games", type=int, default=None,
                        help="Limit number of games to process")
    parser.add_argument("--sample-rate", type=float, default=0.25,
                        help="Fraction of positions to sample per game (default: 0.25)")
    args = parser.parse_args()

    prepare_dataset(args.input, args.output, args.max_games, args.sample_rate)


if __name__ == "__main__":
    main()
