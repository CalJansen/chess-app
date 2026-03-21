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
import json
import sys
import time
import uuid
from datetime import datetime
import chess

# Add backend to path so we can import engines
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from engines.random_engine import RandomEngine
from engines.material_engine import MaterialEngine
from engines.minimax_engine import MinimaxEngine
from engines.mcts_engine import MCTSEngine
from engines.nn_engine import discover_models


MAX_MOVES = 150  # Per side — prevents infinite games (with claim_draw, most end much sooner)


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
        dict with keys:
            "result": "white" | "black" | "draw"
            "moves": list of SAN move strings
    """
    board = chess.Board()
    move_count = 0
    moves = []

    while not board.is_game_over(claim_draw=True) and move_count < MAX_MOVES * 2:
        if board.turn == chess.WHITE:
            move = white_engine.select_move(board)
        else:
            move = black_engine.select_move(board)

        san = board.san(move)
        moves.append(san)

        if verbose and move_count < 10:
            side = "W" if board.turn == chess.WHITE else "B"
            print(f"    {side}: {san}", end="")

        board.push(move)
        move_count += 1

    if verbose:
        print()

    outcome = board.outcome(claim_draw=True)
    if outcome and outcome.winner is not None:
        result = "white" if outcome.winner == chess.WHITE else "black"
    else:
        result = "draw"

    return {"result": result, "moves": moves}


def run_match(engine_a, engine_b, num_games, verbose=False):
    """
    Run a match between two engines, alternating colors.

    Returns dict with results from engine_a's perspective:
        {"wins": int, "losses": int, "draws": int, "sample_game": dict|None}

    sample_game is a randomly selected game from the match with full move history.
    """
    results = {"wins": 0, "losses": 0, "draws": 0}
    # Pick a random game index to sample for replay
    import random as _random
    sample_index = _random.randint(0, num_games - 1) if num_games > 0 else 0
    sample_game = None

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

        game_data = play_game(white, black)
        game_result = game_data["result"]

        if game_result == a_color:
            results["wins"] += 1
            outcome = "WIN"
        elif game_result == "draw":
            results["draws"] += 1
            outcome = "DRAW"
        else:
            results["losses"] += 1
            outcome = "LOSS"

        if verbose:
            print(outcome)

        # Save the sampled game
        if i == sample_index:
            white_name = engine_a.name if a_color == "white" else engine_b.name
            black_name = engine_b.name if a_color == "white" else engine_a.name
            result_str = "1-0" if game_result == "white" else "0-1" if game_result == "black" else "1/2-1/2"
            sample_game = {
                "id": str(uuid.uuid4())[:8],
                "date": datetime.now().isoformat(),
                "moves": game_data["moves"],
                "result": result_str,
                "opening": "",
                "whitePlayer": white_name,
                "blackPlayer": black_name,
            }

    results["sample_game"] = sample_game
    return results


def run_tournament(engine_names=None, num_games=10, verbose=False,
                   time_limit=5.0, save_games=True):
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

    # Set time limits on all engines
    for engine in engines.values():
        engine.time_limit = time_limit

    names = list(engines.keys())
    print(f"Tournament: {len(names)} engines, {num_games} games per pairing, "
          f"{time_limit}s time limit per move")
    print(f"Engines: {', '.join(names)}\n")

    # Track overall standings: {name: {"wins": 0, "losses": 0, "draws": 0, "points": 0}}
    standings = {name: {"wins": 0, "losses": 0, "draws": 0, "points": 0.0}
                 for name in names}

    # Results table for head-to-head display
    h2h = {}
    saved_games = []  # Sampled games for replay

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

            # Collect sample game for replay
            if result.get("sample_game"):
                saved_games.append(result["sample_game"])

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

    # Save sampled games to disk for replay
    if save_games and saved_games:
        games_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "tournament_games")
        os.makedirs(games_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        games_file = os.path.join(games_dir, f"tournament_{timestamp}.json")
        with open(games_file, "w") as f:
            json.dump(saved_games, f, indent=2)
        print(f"\nSaved {len(saved_games)} sample games to {games_file}")


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
    parser.add_argument("--time-limit", type=float, default=5.0,
                        help="Max seconds per move (default: 5.0)")
    parser.add_argument("--no-save-games", action="store_true",
                        help="Don't save sample games to disk")
    args = parser.parse_args()

    if args.list:
        registry = get_all_engines()
        print("Available engines:")
        for name, engine in sorted(registry.items()):
            print(f"  {name:<25} [{engine.engine_type}] {engine.description}")
        return

    run_tournament(args.engines, args.games, args.verbose,
                   time_limit=args.time_limit,
                   save_games=not args.no_save_games)


if __name__ == "__main__":
    main()
