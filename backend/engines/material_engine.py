"""
Material Engine — Level 2: Greedy material evaluation.

Strategy: Look at every legal move, pick the one that results in the best
material balance. This is a depth-1 (greedy) search — it only looks one
move ahead.

Key concepts:
  - Piece values: the foundation of chess evaluation. A queen is worth ~9
    pawns, a rook ~5, bishops and knights ~3, and pawns are worth 1.
  - Greedy search: always pick the immediately best option without looking
    further ahead. Simple but surprisingly effective at capturing free pieces.

Weakness: Can't see tactics deeper than 1 move. Will walk into forks, pins,
and skewers. Can't plan or build positions.

Expected strength: ~600-800 Elo (will beat random easily, loses to anyone
who can think 2+ moves ahead)
"""

import random
import chess
from .base import ChessEngine


# ─── Piece Values ──────────────────────────────────────────────────────────────
# Standard centipawn values (divided by 100 for readability).
# These are the most basic building block of chess evaluation.
PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,  # King can't be captured, so no material value
}


def evaluate_material(board: chess.Board) -> int:
    """
    Evaluate a position based purely on material balance.

    Returns a score in centipawns from WHITE's perspective:
      - Positive = white is ahead in material
      - Negative = black is ahead
      - Zero = material is equal

    Example: If white has an extra knight, returns +320.
    """
    score = 0
    for piece_type in PIECE_VALUES:
        # Count white pieces of this type
        white_pieces = len(board.pieces(piece_type, chess.WHITE))
        # Count black pieces of this type
        black_pieces = len(board.pieces(piece_type, chess.BLACK))
        # Add the difference weighted by piece value
        score += (white_pieces - black_pieces) * PIECE_VALUES[piece_type]
    return score


class MaterialEngine(ChessEngine):
    """
    Greedy engine that maximizes material advantage.

    For each legal move, it applies the move, evaluates the resulting
    material balance, and picks the move with the best score.
    If multiple moves tie, it picks randomly among them.
    """

    @property
    def name(self) -> str:
        return "material"

    @property
    def description(self) -> str:
        return "Greedy material -- captures valuable pieces, depth-1 lookahead."

    def select_move(self, board: chess.Board) -> chess.Move:
        best_score = float("-inf")
        best_moves = []

        # Are we playing as white or black?
        is_white = board.turn == chess.WHITE
        # We want to MAXIMIZE our material, so:
        #   - White maximizes evaluate_material (positive is good for white)
        #   - Black minimizes evaluate_material (negative is good for black)
        sign = 1 if is_white else -1

        for move in board.legal_moves:
            board.push(move)
            score = sign * evaluate_material(board)
            board.pop()

            if score > best_score:
                best_score = score
                best_moves = [move]
            elif score == best_score:
                best_moves.append(move)

        # Among equally good moves, pick randomly (adds variety)
        return random.choice(best_moves)
