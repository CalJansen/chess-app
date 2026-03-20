"""
Evaluation endpoint -- Stockfish position analysis.

POST /api/evaluate  { fen, depth } -> { score_cp, mate_in, best_move, pv }
GET  /api/evaluate/status          -> { available: bool }
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from engines.stockfish_eval import evaluate, is_available

router = APIRouter()


# ─── Request / Response models ────────────────────────────────────────────────

class EvalRequest(BaseModel):
    fen: str
    depth: int = Field(default=18, ge=1, le=25)


class EvalResponse(BaseModel):
    score_cp: int               # Centipawns from White's perspective
    mate_in: Optional[int]      # Moves to mate (None if no forced mate)
    best_move: Optional[str]    # Best move in UCI notation
    pv: list[str]               # Principal variation (best line)


class EvalStatus(BaseModel):
    available: bool


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/evaluate", response_model=EvalResponse)
async def evaluate_position(request: EvalRequest):
    """Evaluate a chess position using Stockfish."""

    if not is_available():
        raise HTTPException(
            status_code=503,
            detail="Stockfish not installed. Place stockfish binary in backend/stockfish/ directory."
        )

    result = evaluate(request.fen, request.depth)

    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Stockfish evaluation failed"
        )

    return EvalResponse(
        score_cp=result["score_cp"],
        mate_in=result["mate_in"],
        best_move=result["best_move"],
        pv=result["pv"],
    )


@router.get("/evaluate/status", response_model=EvalStatus)
async def stockfish_status():
    """Check if Stockfish is available for evaluation."""
    return EvalStatus(available=is_available())
