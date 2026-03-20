"""
Tests for all chess engines.

Tests verify:
  1. Every engine returns legal moves
  2. Material/minimax engines capture hanging pieces
  3. Engines handle edge cases (few legal moves, near-checkmate)
"""

import chess
from engines.random_engine import RandomEngine
from engines.material_engine import MaterialEngine
from engines.minimax_engine import MinimaxEngine
from engines.mcts_engine import MCTSEngine


def test_all_engines_return_legal_moves():
    """Every engine must return a legal move from the starting position."""
    engines = [
        RandomEngine(),
        MaterialEngine(),
        MinimaxEngine(depth=2),
        MCTSEngine(simulations=50),  # Low count for test speed
    ]
    board = chess.Board()

    for engine in engines:
        move = engine.select_move(board)
        assert move in board.legal_moves, (
            f"{engine.name} returned illegal move {move}"
        )
        print(f"  {engine.name}: {board.san(move)} OK")


def test_material_captures_free_queen():
    """Material engine should capture a hanging queen."""
    # White queen on e5 is hanging, black pawn on d6 can capture it.
    # No queens left for black (removed), so it's a simple material grab.
    board = chess.Board("rnb1kbnr/ppp2ppp/3p4/4Q3/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1")

    engine = MaterialEngine()
    move = engine.select_move(board)

    # The engine should capture the queen
    assert board.is_capture(move), (
        f"Material engine didn't capture the hanging queen! Played {board.san(move)}"
    )
    print(f"  material captured queen with: {board.san(move)} OK")


def test_minimax_captures_free_queen():
    """Minimax engine should also capture a hanging queen."""
    board = chess.Board("rnb1kbnr/ppp2ppp/3p4/4Q3/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1")

    engine = MinimaxEngine(depth=2)
    move = engine.select_move(board)

    assert board.is_capture(move), (
        f"Minimax engine didn't capture the hanging queen! Played {board.san(move)}"
    )
    print(f"  minimax-d2 captured queen with: {board.san(move)} OK")


def test_minimax_finds_checkmate_in_1():
    """Minimax should find a checkmate in 1 move."""
    # Back-rank mate: white rook on a1 can play Ra8#
    # Black king on h8, no escape squares, no blocking pieces
    board = chess.Board("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1")

    engine = MinimaxEngine(depth=2)
    move = engine.select_move(board)
    san = board.san(move)

    board.push(move)
    assert board.is_checkmate(), (
        f"Minimax didn't find mate in 1! Played {san}"
    )
    print(f"  minimax-d2 found mate: {san} OK")


def test_engines_handle_few_legal_moves():
    """Engines should work when there are very few legal moves."""
    # King and pawn vs king — only a few moves available
    board = chess.Board("8/8/8/8/8/4k3/4P3/4K3 w - - 0 1")

    engines = [
        RandomEngine(),
        MaterialEngine(),
        MinimaxEngine(depth=3),
        MCTSEngine(simulations=50),
    ]

    for engine in engines:
        move = engine.select_move(board)
        assert move in board.legal_moves, (
            f"{engine.name} returned illegal move in endgame"
        )
        print(f"  {engine.name} endgame: {board.san(move)} OK")


def test_engine_metadata():
    """All engines should have name, description, and type."""
    engines = [
        RandomEngine(),
        MaterialEngine(),
        MinimaxEngine(depth=3),
        MinimaxEngine(depth=5),
        MCTSEngine(simulations=800),
    ]

    for engine in engines:
        assert len(engine.name) > 0
        assert len(engine.description) > 0
        assert engine.engine_type in ("classical", "ml", "external")
        print(f"  {engine.name}: {engine.description[:60]}... OK")


if __name__ == "__main__":
    print("\n=== Engine Legal Move Tests ===")
    test_all_engines_return_legal_moves()

    print("\n=== Tactical Tests ===")
    test_material_captures_free_queen()
    test_minimax_captures_free_queen()
    test_minimax_finds_checkmate_in_1()

    print("\n=== Edge Case Tests ===")
    test_engines_handle_few_legal_moves()

    print("\n=== Metadata Tests ===")
    test_engine_metadata()

    print("\n[PASS] All tests passed!")
