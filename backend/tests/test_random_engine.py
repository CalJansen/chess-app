"""Tests for the random engine."""

import chess
from engines.random_engine import RandomEngine


def test_random_engine_returns_legal_move():
    engine = RandomEngine()
    board = chess.Board()

    for _ in range(100):  # Test 100 random moves from starting position
        move = engine.select_move(board)
        assert move in board.legal_moves, f"Illegal move: {move}"


def test_random_engine_works_in_various_positions():
    engine = RandomEngine()

    # Sicilian Defense position
    board = chess.Board()
    board.push_san("e4")
    board.push_san("c5")
    move = engine.select_move(board)
    assert move in board.legal_moves

    # A position with few legal moves (king in corner)
    board = chess.Board("8/8/8/8/8/8/1K6/k7 w - - 0 1")
    move = engine.select_move(board)
    assert move in board.legal_moves


def test_random_engine_metadata():
    engine = RandomEngine()
    assert engine.name == "random"
    assert len(engine.description) > 0
    assert engine.engine_type == "classical"


if __name__ == "__main__":
    test_random_engine_returns_legal_move()
    test_random_engine_works_in_various_positions()
    test_random_engine_metadata()
    print("All tests passed!")
