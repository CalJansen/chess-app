"""
Abstract base class for all chess engines.

Every engine must implement `select_move()`, which takes a python-chess Board
and returns the chosen Move. This is the contract that the API layer depends on.
"""

from abc import ABC, abstractmethod
import chess


class SearchTimeout(Exception):
    """Raised when a search exceeds its time limit."""
    pass


class ChessEngine(ABC):
    """Base class for chess engines."""

    def __init__(self):
        self._time_limit = 5.0  # Default: 5 seconds per move

    @property
    def time_limit(self) -> float:
        """Maximum seconds allowed per move."""
        return self._time_limit

    @time_limit.setter
    def time_limit(self, value: float):
        self._time_limit = max(0.1, value)  # Minimum 0.1s

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for this engine (used in API calls)."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of the engine's strategy."""
        ...

    @property
    def engine_type(self) -> str:
        """Category: 'classical', 'ml', or 'external'."""
        return "classical"

    @abstractmethod
    def select_move(self, board: chess.Board) -> chess.Move:
        """
        Given the current board position, return the move this engine wants to play.

        Args:
            board: A python-chess Board object representing the current position.
                   The board is guaranteed to have at least one legal move.

        Returns:
            A python-chess Move object representing the chosen move.
        """
        ...
