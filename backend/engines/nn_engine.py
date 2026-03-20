"""
Neural Network Engine — Uses a trained ResNet as the evaluation function.

Instead of the handcrafted material + piece-square-table evaluation from
the minimax engine, this engine uses a neural network to evaluate positions.
The NN was trained on thousands of real games, so it has learned patterns
that are hard to encode by hand (pawn structure, king safety, piece activity).

The engine uses minimax search (depth 2) with the neural network for
leaf node evaluation. Depth 2 is shallow, but each NN evaluation captures
much more positional understanding than a traditional eval function.

How it works:
  1. At each leaf node, encode the board as an 18x8x8 tensor
  2. Run the tensor through the neural network
  3. Get a value in [-1, 1] predicting the game outcome
  4. Use this value in the minimax search to pick the best move

This is similar to how AlphaZero works, but much simpler:
  - AlphaZero uses MCTS + NN (we use minimax + NN)
  - AlphaZero trains via self-play (we train on human games)
  - AlphaZero's network is much larger (20+ blocks vs our 4)
"""

import os
import time
import random
import torch
import numpy as np
import chess

from .base import ChessEngine
from .nn_model import ChessValueNetwork
from training.board_encoding import encode_board


MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")


class NNEngine(ChessEngine):
    """
    Chess engine that uses a neural network for position evaluation.

    The network evaluates positions, and minimax search finds the best move.
    """

    def __init__(self, model_path: str, search_depth: int = 2):
        self._model_path = model_path
        self._search_depth = search_depth
        self._model_name = os.path.splitext(os.path.basename(model_path))[0]
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load the trained model
        checkpoint = torch.load(model_path, weights_only=True, map_location=self._device)
        self._model = ChessValueNetwork(
            num_blocks=checkpoint.get("num_blocks", 4),
            num_filters=checkpoint.get("num_filters", 64),
        ).to(self._device)
        self._model.load_state_dict(checkpoint["model_state_dict"])
        self._model.eval()

        self._val_loss = checkpoint.get("best_val_loss", None)
        self._train_positions = checkpoint.get("train_positions", None)

        print(f"  Loaded NN model: {self._model_name} (device={self._device})")

    @property
    def name(self) -> str:
        return f"nn-{self._model_name}"

    @property
    def description(self) -> str:
        desc = f"Neural network engine ({self._model_name}), minimax depth {self._search_depth}"
        if self._train_positions:
            desc += f", trained on {self._train_positions:,} positions"
        return desc

    @property
    def engine_type(self) -> str:
        return "ml"

    def _evaluate(self, board: chess.Board) -> float:
        """
        Evaluate a position using the neural network.

        Returns a score from white's perspective:
          +1.0 = white winning
          -1.0 = black winning
           0.0 = equal
        """
        # Handle terminal positions without the network
        if board.is_checkmate():
            return -1.0 if board.turn == chess.WHITE else 1.0
        if board.is_stalemate() or board.is_insufficient_material():
            return 0.0

        # Encode and evaluate
        encoded = encode_board(board)
        tensor = torch.from_numpy(encoded).unsqueeze(0).to(self._device)  # (1, 18, 8, 8)

        with torch.no_grad():
            value = self._model(tensor).item()

        return value

    def _minimax(self, board: chess.Board, depth: int, alpha: float, beta: float,
                 maximizing: bool, stats: dict) -> float:
        """Minimax search using neural network evaluation at leaf nodes."""
        stats["nodes"] += 1

        if depth == 0 or board.is_game_over():
            return self._evaluate(board)

        if maximizing:
            max_eval = float("-inf")
            for move in board.legal_moves:
                board.push(move)
                eval_score = self._minimax(board, depth - 1, alpha, beta, False, stats)
                board.pop()
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    stats["cutoffs"] += 1
                    break
            return max_eval
        else:
            min_eval = float("inf")
            for move in board.legal_moves:
                board.push(move)
                eval_score = self._minimax(board, depth - 1, alpha, beta, True, stats)
                board.pop()
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    stats["cutoffs"] += 1
                    break
            return min_eval

    def select_move(self, board: chess.Board) -> chess.Move:
        start_time = time.time()
        stats = {"nodes": 0, "cutoffs": 0}

        best_score = float("-inf") if board.turn == chess.WHITE else float("inf")
        best_moves = []
        is_maximizing = board.turn == chess.WHITE

        for move in board.legal_moves:
            board.push(move)
            score = self._minimax(
                board, self._search_depth - 1,
                float("-inf"), float("inf"),
                not is_maximizing, stats,
            )
            board.pop()

            if is_maximizing:
                if score > best_score:
                    best_score = score
                    best_moves = [move]
                elif score == best_score:
                    best_moves.append(move)
            else:
                if score < best_score:
                    best_score = score
                    best_moves = [move]
                elif score == best_score:
                    best_moves.append(move)

        elapsed = time.time() - start_time
        print(
            f"  [{self.name}] depth={self._search_depth} | "
            f"nodes={stats['nodes']:,} | cutoffs={stats['cutoffs']:,} | "
            f"score={best_score:.4f} | time={elapsed:.2f}s"
        )

        return random.choice(best_moves)


def discover_models(models_dir: str = MODELS_DIR) -> list:
    """
    Auto-discover trained .pt model files and create engine instances.

    Scans the models directory for .pt files and creates an NNEngine
    for each one. This lets you train multiple models and have them
    all appear automatically in the engine list.
    """
    engines = []
    if not os.path.isdir(models_dir):
        return engines

    for filename in sorted(os.listdir(models_dir)):
        if not filename.endswith(".pt"):
            continue
        model_path = os.path.join(models_dir, filename)
        try:
            engine = NNEngine(model_path, search_depth=2)
            engines.append(engine)
        except Exception as e:
            print(f"  Warning: Could not load model {filename}: {e}")

    return engines
