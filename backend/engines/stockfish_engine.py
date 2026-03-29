"""
Stockfish as a playable chess engine at various Elo levels.

Uses Stockfish's UCI_LimitStrength and UCI_Elo options to constrain playing
strength, making it possible to play competitive games at any level from
beginner (~800 Elo) to expert (~2500 Elo).

The engine reuses the existing StockfishProcess singleton from stockfish_eval.py,
with evaluate_with_options() ensuring atomic option-setting and search.
"""

import random
import chess
from .base import ChessEngine
from .stockfish_eval import _engine, is_available


# Map Elo to search depth — lower Elo uses shallower search for faster play
# and to avoid the engine "accidentally" playing too well at low depth
_ELO_DEPTH = {
    800: 8,
    1000: 10,
    1200: 12,
    1400: 14,
    1600: 16,
    2000: 18,
    2500: 20,
}


class StockfishEngine(ChessEngine):
    """
    Stockfish engine constrained to a target Elo rating.

    Uses UCI_LimitStrength + UCI_Elo to limit playing strength.
    Each instance represents one difficulty level.
    """

    def __init__(self, elo: int = 1600):
        super().__init__()
        self._elo = elo
        self._depth = _ELO_DEPTH.get(elo, 14)

    @property
    def name(self) -> str:
        return f"stockfish-{self._elo}"

    @property
    def description(self) -> str:
        return f"Stockfish at ~{self._elo} Elo"

    @property
    def engine_type(self) -> str:
        return "external"

    def select_move(self, board: chess.Board) -> chess.Move:
        if not is_available() or _engine is None:
            # Fallback: random legal move if Stockfish unavailable
            return random.choice(list(board.legal_moves))

        options = {
            "UCI_LimitStrength": "true",
            "UCI_Elo": str(self._elo),
        }

        result = _engine.evaluate_with_options(
            board.fen(), depth=self._depth, options=options
        )

        # Reset to full strength so the eval bar isn't affected
        _engine.set_options({"UCI_LimitStrength": "false"})

        if result and result["best_move"]:
            try:
                return chess.Move.from_uci(result["best_move"])
            except ValueError:
                pass

        # Fallback: random legal move
        return random.choice(list(board.legal_moves))
