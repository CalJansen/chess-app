"""
Stockfish as a playable chess engine at various strength levels.

Two approaches for limiting strength:

1. StockfishEngine (UCI_LimitStrength + UCI_Elo):
   Stockfish's built-in Elo targeting. Injects random errors to hit a target
   Elo rating. Can feel unnatural — engine finds strong tactics then randomly
   blunders.

2. StockfishSkillEngine (Skill Level 0-20):
   Reduces search quality rather than injecting errors. Produces more
   "human-like" weak play — the engine genuinely doesn't see as far ahead
   at lower skill levels.

Both reuse the existing StockfishProcess singleton from stockfish_eval.py,
with evaluate_with_options() ensuring atomic option-setting and search.
"""

import random
import chess
from .base import ChessEngine
from .stockfish_eval import _engine, is_available


# ─── Elo-based engine ────────────────────────────────────────────────────────

# Map Elo to search depth
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
            return random.choice(list(board.legal_moves))

        options = {
            "UCI_LimitStrength": "true",
            "UCI_Elo": str(self._elo),
        }

        try:
            result = _engine.evaluate_with_options(
                board.fen(), depth=self._depth, options=options
            )
        finally:
            _engine.set_options({"UCI_LimitStrength": "false"})

        if result and result["best_move"]:
            try:
                return chess.Move.from_uci(result["best_move"])
            except ValueError:
                pass

        return random.choice(list(board.legal_moves))


# ─── Skill Level engine ──────────────────────────────────────────────────────

# Map skill level to search depth and approximate Elo
_SKILL_CONFIG = {
    0:  {"depth": 5,  "elo": "~800"},
    3:  {"depth": 6,  "elo": "~1000"},
    5:  {"depth": 8,  "elo": "~1200"},
    8:  {"depth": 10, "elo": "~1400"},
    10: {"depth": 12, "elo": "~1600"},
    13: {"depth": 14, "elo": "~1800"},
    15: {"depth": 16, "elo": "~2000"},
    18: {"depth": 18, "elo": "~2400"},
    20: {"depth": 20, "elo": "~3000+"},
}


class StockfishSkillEngine(ChessEngine):
    """
    Stockfish engine using Skill Level (0-20) for more human-like weak play.

    Unlike UCI_LimitStrength which injects random blunders, Skill Level
    reduces the engine's search quality — it genuinely doesn't see as far
    at lower levels, producing more natural-feeling games.
    """

    def __init__(self, skill: int = 10):
        super().__init__()
        self._skill = skill
        config = _SKILL_CONFIG.get(skill, {"depth": 12, "elo": f"~skill {skill}"})
        self._depth = config["depth"]
        self._approx_elo = config["elo"]

    @property
    def name(self) -> str:
        return f"stockfish-skill-{self._skill}"

    @property
    def description(self) -> str:
        return f"Stockfish Skill {self._skill} ({self._approx_elo})"

    @property
    def engine_type(self) -> str:
        return "external"

    def select_move(self, board: chess.Board) -> chess.Move:
        if not is_available() or _engine is None:
            return random.choice(list(board.legal_moves))

        options = {
            "Skill Level": str(self._skill),
        }

        try:
            result = _engine.evaluate_with_options(
                board.fen(), depth=self._depth, options=options
            )
        finally:
            # Reset to full skill so the eval bar stays accurate
            _engine.set_options({"Skill Level": "20"})

        if result and result["best_move"]:
            try:
                return chess.Move.from_uci(result["best_move"])
            except ValueError:
                pass

        return random.choice(list(board.legal_moves))
