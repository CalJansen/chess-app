"""
Stockfish evaluation wrapper.

Communicates with the Stockfish UCI engine via subprocess stdin/stdout.
We avoid python-chess's SimpleEngine.popen_uci() because it uses asyncio
subprocess internally, which conflicts with uvicorn's event loop on Windows
(raises NotImplementedError).

Instead, we talk UCI protocol directly -- it's simple:
  1. Send "uci" -> wait for "uciok"
  2. Send "isready" -> wait for "readyok"
  3. Send "position fen <fen>" then "go depth <n>" -> parse "info" and "bestmove"

If the Stockfish binary is not found, all functions degrade gracefully:
  - is_available() returns False
  - evaluate() returns None
"""

import os
import glob
import subprocess
import threading
import chess

from config import STOCKFISH_DIR

# Resolve STOCKFISH_DIR relative to the backend root (parent of engines/)
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_STOCKFISH_PATH = os.path.join(_BACKEND_DIR, STOCKFISH_DIR)


class StockfishProcess:
    """
    Manages a persistent Stockfish subprocess via UCI protocol.
    Thread-safe: uses a lock so concurrent evaluation requests are serialized.
    """

    def __init__(self, binary_path: str):
        self._lock = threading.Lock()
        self._process = subprocess.Popen(
            [binary_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,  # Line-buffered
        )

        # Initialize UCI protocol
        self._send("uci")
        self._read_until("uciok")

        # Wait until engine is ready
        self._send("isready")
        self._read_until("readyok")

    def _send(self, command: str) -> None:
        """Send a command to Stockfish's stdin."""
        self._process.stdin.write(command + "\n")
        self._process.stdin.flush()

    def _read_until(self, target: str) -> list[str]:
        """Read stdout lines until we see one starting with target. Returns all lines."""
        lines = []
        while True:
            line = self._process.stdout.readline().strip()
            if not line and self._process.poll() is not None:
                break  # Process died
            lines.append(line)
            if line.startswith(target):
                break
        return lines

    def evaluate(self, fen: str, depth: int = 18) -> dict | None:
        """
        Evaluate a position. Thread-safe.

        Returns dict with score_cp, mate_in, best_move, pv.
        """
        with self._lock:
            try:
                # Set up position
                self._send("position fen %s" % fen)

                # Start search
                self._send("go depth %d" % depth)

                # Read output until we get "bestmove"
                best_info_line = None
                best_move_str = None
                lines = []

                while True:
                    line = self._process.stdout.readline().strip()
                    if not line and self._process.poll() is not None:
                        break

                    lines.append(line)

                    # Track the last "info depth N" line with a score
                    if line.startswith("info depth") and " score " in line:
                        best_info_line = line

                    # "bestmove e2e4 ponder e7e5" signals search is done
                    if line.startswith("bestmove"):
                        parts = line.split()
                        best_move_str = parts[1] if len(parts) >= 2 else None
                        break

                # Parse the score from the last info line
                score_cp = 0
                mate_in = None
                pv = []

                if best_info_line:
                    score_cp, mate_in = self._parse_score(best_info_line)
                    pv = self._parse_pv(best_info_line)

                return {
                    "score_cp": score_cp,
                    "mate_in": mate_in,
                    "best_move": best_move_str,
                    "pv": pv,
                }

            except Exception as e:
                print("[Stockfish] Evaluation error: %s" % e)
                return None

    def _parse_score(self, info_line: str) -> tuple[int, int | None]:
        """
        Parse score from an info line.
        Examples:
          "info depth 18 ... score cp 35 ..."    -> (35, None)
          "info depth 18 ... score mate 3 ..."   -> (10000, 3)
          "info depth 18 ... score mate -2 ..."  -> (-10000, -2)
        """
        parts = info_line.split()
        try:
            score_idx = parts.index("score")
            score_type = parts[score_idx + 1]
            score_value = int(parts[score_idx + 2])

            if score_type == "cp":
                return (score_value, None)
            elif score_type == "mate":
                # Convert mate to a large centipawn value
                cp = 10000 if score_value > 0 else -10000
                return (cp, score_value)
        except (ValueError, IndexError):
            pass

        return (0, None)

    def _parse_pv(self, info_line: str) -> list[str]:
        """
        Parse principal variation from an info line.
        "info depth 18 ... pv e2e4 e7e5 d2d4 ..."
        """
        parts = info_line.split()
        try:
            pv_idx = parts.index("pv")
            # PV runs from pv_idx+1 until the end (or next keyword)
            pv_moves = []
            for p in parts[pv_idx + 1:]:
                # UCI moves are 4-5 chars (e2e4, e7e8q)
                if len(p) >= 4 and p[0].isalpha():
                    pv_moves.append(p)
                else:
                    break
            return pv_moves
        except ValueError:
            return []

    def quit(self) -> None:
        """Cleanly shut down the Stockfish process."""
        try:
            self._send("quit")
            self._process.wait(timeout=5)
        except Exception:
            self._process.kill()


# ─── Module-level engine instance ─────────────────────────────────────────────

_engine: StockfishProcess | None = None


def _find_stockfish_binary() -> str | None:
    """Search the _STOCKFISH_PATH for an executable file."""
    if not os.path.isdir(_STOCKFISH_PATH):
        return None

    # Look for .exe files on Windows, or any file on Unix
    patterns = [
        os.path.join(_STOCKFISH_PATH, "*.exe"),
        os.path.join(_STOCKFISH_PATH, "stockfish*"),
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            return os.path.abspath(matches[0])
    return None


def _init_engine() -> None:
    """Try to open the Stockfish engine. Called once at module load."""
    global _engine

    binary_path = _find_stockfish_binary()
    if binary_path is None:
        print("[Stockfish] No binary found in '%s/' -- evaluation disabled" % _STOCKFISH_PATH)
        print("[Stockfish] Download from https://stockfishchess.org/download/")
        return

    try:
        print("[Stockfish] Opening: %s" % binary_path)
        _engine = StockfishProcess(binary_path)
        print("[Stockfish] Engine loaded successfully")
    except Exception as e:
        import traceback
        print("[Stockfish] Failed to start engine: %s" % e)
        traceback.print_exc()
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
    return _engine.evaluate(fen, depth)


def shutdown() -> None:
    """Cleanly close the Stockfish process."""
    global _engine
    if _engine is not None:
        _engine.quit()
        print("[Stockfish] Engine shut down")
        _engine = None
