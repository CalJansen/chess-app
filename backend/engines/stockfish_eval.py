"""
Stockfish evaluation wrapper.

Uses python-chess's UCI engine interface to communicate with Stockfish.
The engine is opened once as a persistent subprocess and reused for all
evaluation requests -- much faster than spawning per-request.

If the Stockfish binary is not found, all functions degrade gracefully:
  - is_available() returns False
  - evaluate() returns None
"""

import os
import glob
import chess
import chess.engine

from config import STOCKFISH_DIR

# ─── Locate and open Stockfish ────────────────────────────────────────────────

_engine: chess.engine.SimpleEngine | None = None


def _find_stockfish_binary() -> str | None:
    """Search the STOCKFISH_DIR for an executable file."""
    if not os.path.isdir(STOCKFISH_DIR):
        return None

    # Look for .exe files on Windows, or any file on Unix
    patterns = [
        os.path.join(STOCKFISH_DIR, "*.exe"),
        os.path.join(STOCKFISH_DIR, "stockfish*"),
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return None


def _init_engine() -> None:
    """Try to open the Stockfish engine. Called once at module load."""
    global _engine

    binary_path = _find_stockfish_binary()
    if binary_path is None:
        print("[Stockfish] No binary found in '%s/' -- evaluation disabled" % STOCKFISH_DIR)
        print("[Stockfish] Download from https://stockfishchess.org/download/")
        return

    try:
        _engine = chess.engine.SimpleEngine.popen_uci(binary_path)
        print("[Stockfish] Engine loaded: %s" % binary_path)
    except Exception as e:
        print("[Stockfish] Failed to start engine: %s" % e)
        _engine = None


# Initialize on import
_init_engine()


# ─── Public API ───────────────────────────────────────────────────────────────

def is_available() -> bool:
    """Check if Stockfish is loaded and ready."""
    return _engine is not None


def evaluate(fen: str, depth: int = 18) -> dict | None:
    """
    Evaluate a chess position using Stockfish.

    Args:
        fen:   FEN string of the position to evaluate
        depth: Search depth (1-25). Higher = stronger but slower.
               Depth 18 is a good balance (~0.5s on modern hardware).

    Returns:
        Dict with:
          - score_cp:  Centipawn score from White's perspective
                       (positive = White is better, negative = Black is better)
          - mate_in:   Number of moves to mate (None if no forced mate)
                       Positive = White mates, negative = Black mates
          - best_move: Best move in UCI notation (e.g., "e2e4")
          - pv:        Principal variation -- the expected best sequence of moves
        Or None if Stockfish is not available.
    """
    if _engine is None:
        return None

    try:
        board = chess.Board(fen)

        # Analyse with both a depth limit and a time limit (safety net)
        info = _engine.analyse(
            board,
            chess.engine.Limit(depth=depth, time=10.0),
        )

        # Extract score -- always from White's perspective
        score = info["score"].white()
        cp = score.score(mate_score=10000)    # centipawns, +/-10000 for mate
        mate = score.mate()                    # None or moves-to-mate

        # Extract the principal variation (best line of play)
        pv = info.get("pv", [])
        best_move = pv[0].uci() if pv else None
        pv_uci = [m.uci() for m in pv]

        return {
            "score_cp": cp,
            "mate_in": mate,
            "best_move": best_move,
            "pv": pv_uci,
        }

    except Exception as e:
        print("[Stockfish] Evaluation error: %s" % e)
        return None


def shutdown() -> None:
    """Cleanly close the Stockfish process."""
    global _engine
    if _engine is not None:
        try:
            _engine.quit()
            print("[Stockfish] Engine shut down")
        except Exception:
            pass
        _engine = None
