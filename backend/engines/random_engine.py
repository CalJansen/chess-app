"""
Random Engine — Level 1: The simplest possible chess "AI".

Strategy: Pick a random legal move. No evaluation, no lookahead.
This serves as the baseline — any smarter engine should beat this consistently.

Expected strength: ~200 Elo (beginner level, will blunder constantly)
"""

import random
import chess
from .base import ChessEngine


class RandomEngine(ChessEngine):
    """Plays a random legal move every turn."""

    @property
    def name(self) -> str:
        return "random"

    @property
    def description(self) -> str:
        return "Random moves -- picks any legal move at random. The simplest baseline."

    def select_move(self, board: chess.Board) -> chess.Move:
        legal_moves = list(board.legal_moves)
        return random.choice(legal_moves)
