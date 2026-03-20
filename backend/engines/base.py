"""
Abstract base class for all chess engines.

Every engine must implement `select_move()`, which takes a python-chess Board
and returns the chosen Move. This is the contract that the API layer depends on.
"""

from abc import ABC, abstractmethod
import chess


class ChessEngine(ABC):
    """Base class for chess engines."""

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
