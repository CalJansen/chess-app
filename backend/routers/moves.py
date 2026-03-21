"""
Move endpoint — the core API for getting AI moves.

POST /api/move
  Request:  { "fen": "...", "engine": "random" }
  Response: { "move": "e2e4", "san": "e4", "fen_after": "..." }
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import chess

router = APIRouter()

# Engine registry — populated by main.py at startup
engine_registry: dict = {}


class MoveRequest(BaseModel):
    fen: str
    engine: str = "random"
    time_limit: float = 5.0  # Max seconds for the engine to think


class MoveResponse(BaseModel):
    move: str       # UCI notation (e.g., "e2e4")
    san: str        # Standard algebraic notation (e.g., "e4")
    fen_after: str  # FEN after the move is applied


@router.post("/move", response_model=MoveResponse)
async def get_move(request: MoveRequest):
    """Get the AI's chosen move for the given position."""

    # Validate FEN
    try:
        board = chess.Board(request.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid FEN string")

    # Check if game is already over
    if board.is_game_over():
        raise HTTPException(status_code=400, detail="Game is already over")

    # Check if there are legal moves
    if not list(board.legal_moves):
        raise HTTPException(status_code=400, detail="No legal moves available")

    # Look up the engine
    engine = engine_registry.get(request.engine)
    if engine is None:
        available = list(engine_registry.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unknown engine '{request.engine}'. Available: {available}"
        )

    # Set time limit and get the engine's move
    engine.time_limit = request.time_limit
    try:
        move = engine.select_move(board)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Engine error: {str(e)}"
        )

    # Validate the move is legal
    if move not in board.legal_moves:
        raise HTTPException(
            status_code=500,
            detail=f"Engine returned illegal move: {move}"
        )

    # Get SAN before pushing the move
    san = board.san(move)

    # Apply the move to get the resulting FEN
    board.push(move)

    return MoveResponse(
        move=move.uci(),
        san=san,
        fen_after=board.fen(),
    )
