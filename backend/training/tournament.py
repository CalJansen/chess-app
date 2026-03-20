"""
Engine Tournament — Pit engines against each other in automated matches.

Runs round-robin or head-to-head matches between any registered engines,
tracking wins, draws, and losses. This is the most meaningful way to
compare engine strength — validation loss tells you how well a model
predicts game outcomes, but tournament results tell you how well it
actually plays chess.

Each game alternates colors (engine A plays white, then black) to ensure
fairness. Games are capped at 200 moves to prevent infinite loops from
weak engines that can't deliver checkmate.

Usage:
    # All engines round-robin, 10 games each pairing
    python -m training.tournament --games 10

    # Head-to-head between two specific engines
    python -m training.tournament --engines nn-chess_value_v1 minimax-d3 --games 20

    # Include only ML engines + one baseline
    python -m training.tournament --engines nn-chess_value_v1 nn-chess_value_v2 material --games 30
"""

import argparse
import sys
import time
import chess

# Add backend to path so we can import engines
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from engines.random_engine import RandomEngine
from engines.material_engine import MaterialEngine
from engines.minimax_engine import MinimaxEngine
from engines.mcts_engine import MCTSEngine
from engines.nn_engine import discover_models


MAX_MOVES = 200  # Per side — prevents infinite games


def get_all_engines():
    """Build the full engine registry (same as main.py)."""
    registry = {}

    for engine in [
        RandomEngine(),
        MaterialEngine(),
        MinimaxEngine(depth=3),
        MinimaxEngine(depth=5),
        MCTSEngine(simulations=800),
    ]:
        registry[engine.name] = engine

    for engine in discover_models():
        registry[engine.name] = engine

    return registry


def play_game(white_engine, black_engine, verbose=False):
    """
    Play a single game between two engines.

    Returns:
        "white" if white wins, "black" if black wins, "draw" for draws
    """
    board = chess.Board()
    move_count = 0

    while not board.is_game_over() and move_count < MAX_MOVES * 2:
        if board.turn == chess.WHITE:
            move = white_engine.select_move(board)
        else:
            move = black_engine.select_move(board)

        if verbose and move_count < 10:
            san = board.san(move)
            side = "W" if board.turn == chess.WHITE else "B"
            print(f"    {side}: {san}", end="")

        board.push(move)
        move_count += 1

    if verbose:
        print()

    if board.is_checkmate():
        # The side to move is checkmated
        return "black" if board.turn == chess.WHITE else "white"
    else:
        return "draw"


def run_match(engine_a, engine_b, num_games, verbose=False):
    """
    Run a match between two engines, alternating colors.

    Returns dict with results from engine_a's perspective:
        {"wins": int, "losses": int, "draws": int}
    """
    results = {"wins": 0, "losses": 0, "draws": 0}

    for i in range(num_games):
        # Alternate colors each game
        if i % 2 == 0:
            white, black = engine_a, engine_b
            a_color = "white"
        else:
            white, black = engine_b, engine_a
            a_color = "black"

        if verbose:
            colors = f"{engine_a.name}(W) vs {engine_b.name}(B)" if a_color == "white" \
                else f"{engine_b.name}(W) vs {engine_a.name}(B)"
            print(f"  Game {i + 1}/{num_games}: {colors}", end=" ... ")

        result = play_game(white, black)

        if result == a_color:
            results["wins"] += 1
            outcome = "WIN"
        elif result == "draw":
            results["draws"] += 1
            outcome = "DRAW"
        else:
            results["losses"] += 1
            outcome = "LOSS"

        if verbose:
            print(outcome)

    return results


def run_tournament(engine_names=None, num_games=10, verbose=False):
    """
    Run a round-robin tournament between selected engines.
    """
    registry = get_all_engines()

    if engine_names:
        missing = [n for n in engine_names if n not in registry]
        if missing:
            print(f"Error: engines not found: {', '.join(missing)}")
            print(f"Available: {', '.join(sorted(registry.keys()))}")
            return
        engines = {n: registry[n] for n in engine_names}
    else:
        engines = registry

    names = list(engines.keys())
    print(f"Tournament: {len(names)} engines, {num_games} games per pairing")
    print(f"Engines: {', '.join(names)}\n")

    # Track overall standings: {name: {"wins": 0, "losses": 0, "draws": 0, "points": 0}}
    standings = {name: {"wins": 0, "losses": 0, "draws": 0, "points": 0.0}
                 for name in names}

    # Results table for head-to-head display
    h2h = {}

    total_pairings = len(names) * (len(names) - 1) // 2
    pairing_num = 0

    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            pairing_num += 1
            a_name, b_name = names[i], names[j]
            a_engine, b_engine = engines[a_name], engines[b_name]

            print(f"--- Match {pairing_num}/{total_pairings}: "
                  f"{a_name} vs {b_name} ({num_games} games) ---")

            start = time.time()
            result = run_match(a_engine, b_engine, num_games, verbose)
            elapsed = time.time() - start

            # Score: 1 point for win, 0.5 for draw
            a_points = result["wins"] + 0.5 * result["draws"]
            b_points = result["losses"] + 0.5 * result["draws"]

            standings[a_name]["wins"] += result["wins"]
            standings[a_name]["losses"] += result["losses"]
            standings[a_name]["draws"] += result["draws"]
            standings[a_name]["points"] += a_points

            standings[b_name]["wins"] += result["losses"]
            standings[b_name]["losses"] += result["wins"]
            standings[b_name]["draws"] += result["draws"]
            standings[b_name]["points"] += b_points

            h2h[(a_name, b_name)] = result

            print(f"  Result: {a_name} {result['wins']}W-{result['draws']}D-{result['losses']}L "
                  f"({a_points:.1f}-{b_points:.1f}) | {elapsed:.1f}s\n")

    # Print final standings
    print("=" * 70)
    print("FINAL STANDINGS")
    print("=" * 70)

    sorted_names = sorted(names, key=lambda n: standings[n]["points"], reverse=True)

    # Header
    max_name_len = max(len(n) for n in names)
    header = f"{'#':<4} {'Engine':<{max_name_len + 2}} {'Points':>8} {'W':>5} {'D':>5} {'L':>5} {'Win%':>7}"
    print(header)
    print("-" * len(header))

    for rank, name in enumerate(sorted_names, 1):
        s = standings[name]
        total = s["wins"] + s["losses"] + s["draws"]
        win_pct = (s["wins"] + 0.5 * s["draws"]) / total * 100 if total > 0 else 0
        print(f"{rank:<4} {name:<{max_name_len + 2}} {s['points']:>8.1f} "
              f"{s['wins']:>5} {s['draws']:>5} {s['losses']:>5} {win_pct:>6.1f}%")

    print()

    # Head-to-head matrix
    if len(names) > 2:
        print("HEAD-TO-HEAD (row vs column, from row's perspective: W-D-L)")
        print("-" * 70)
        # Abbreviated names for the matrix
        abbrevs = {n: n[:12] for n in names}
        col_w = 14
        print(f"{'':>{col_w}}", end="")
        for n in sorted_names:
            print(f"{abbrevs[n]:>{col_w}}", end="")
        print()

        for a in sorted_names:
            print(f"{abbrevs[a]:>{col_w}}", end="")
            for b in sorted_names:
                if a == b:
                    cell = "---"
                elif (a, b) in h2h:
                    r = h2h[(a, b)]
                    cell = f"{r['wins']}-{r['draws']}-{r['losses']}"
                elif (b, a) in h2h:
                    r = h2h[(b, a)]
                    cell = f"{r['losses']}-{r['draws']}-{r['wins']}"
                else:
                    cell = ""
                print(f"{cell:>{col_w}}", end="")
            print()


def main():
    parser = argparse.ArgumentParser(description="Run engine tournament")
    parser.add_argument("--engines", nargs="*", default=None,
                        help="Engine names to include (default: all)")
    parser.add_argument("--games", type=int, default=10,
                        help="Games per pairing (default: 10)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Show individual game results")
    parser.add_argument("--list", action="store_true",
                        help="List available engines and exit")
    args = parser.parse_args()

    if args.list:
        registry = get_all_engines()
        print("Available engines:")
        for name, engine in sorted(registry.items()):
            print(f"  {name:<25} [{engine.engine_type}] {engine.description}")
        return

    run_tournament(args.engines, args.games, args.verbose)


if __name__ == "__main__":
    main()
