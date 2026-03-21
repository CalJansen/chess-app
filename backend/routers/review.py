"""
Game Review endpoint -- Analyze all moves in a completed game.

POST /api/review  { moves: ["e4", "e5", ...] }
  -> { analysis: [{ move, classification, score_before, score_after, score_loss }, ...],
       accuracy: { white, black } }

Move classifications (modeled after Chess.com / Lichess):
  - "best"       : The engine's top choice (or within 5 cp)
  - "excellent"   : Score loss <= 15 cp
  - "good"       : Score loss <= 40 cp
  - "inaccuracy" : Score loss <= 80 cp
  - "mistake"    : Score loss <= 200 cp
  - "blunder"    : Score loss > 200 cp
  - "book"       : Early opening moves (first 4 full moves)
  - "forced"     : Only one legal move available
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import chess

from engines.stockfish_eval import evaluate, is_available

router = APIRouter()


# ─── Classification thresholds (centipawns) ──────────────────────────────────

CLASSIFICATIONS = [
    (5,   "best"),
    (15,  "excellent"),
    (40,  "good"),
    (80,  "inaccuracy"),
    (200, "mistake"),
]
# Anything above 200 cp loss = "blunder"

BOOK_MOVES = 4  # First N full moves are classified as "book"


def classify_move(cp_loss: float, is_best: bool, is_book: bool, is_forced: bool) -> str:
    """Classify a move based on centipawn loss."""
    if is_book:
        return "book"
    if is_forced:
        return "forced"
    if is_best:
        return "best"
    for threshold, label in CLASSIFICATIONS:
        if cp_loss <= threshold:
            return label
    return "blunder"


# ─── Request / Response models ────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    moves: list[str]  # SAN moves: ["e4", "e5", "Nf3", ...]
    depth: int = Field(default=16, ge=1, le=22)


class MoveAnalysis(BaseModel):
    move: str                  # SAN notation
    move_number: int           # 1-based full move number
    color: str                 # "white" or "black"
    classification: str        # best/excellent/good/inaccuracy/mistake/blunder/book/forced
    score_before: int          # Centipawns before the move (White's perspective)
    score_after: int           # Centipawns after the move (White's perspective)
    score_loss: int            # Centipawn loss (always >= 0, from mover's perspective)
    best_move: str | None      # Engine's best move in SAN (None if this was best)
    mate_before: int | None    # Mate-in before (None if no mate)
    mate_after: int | None     # Mate-in after (None if no mate)


class AccuracyStats(BaseModel):
    white: float    # 0-100 accuracy percentage
    black: float    # 0-100 accuracy percentage


class ReviewResponse(BaseModel):
    analysis: list[MoveAnalysis]
    accuracy: AccuracyStats


# ─── Accuracy calculation ─────────────────────────────────────────────────────

def calculate_accuracy(analyses: list[MoveAnalysis], color: str) -> float:
    """
    Calculate accuracy percentage for a color.

    Uses a formula inspired by Chess.com:
    accuracy = average of per-move scores, where each move scores:
      - 100% for best/book/forced moves
      - Scaled down based on centipawn loss for others

    The scaling uses: score = max(0, 100 - (cp_loss * 0.5))
    This means ~200 cp loss = 0% for that move.
    """
    color_moves = [a for a in analyses if a.color == color]
    if not color_moves:
        return 100.0

    total_score = 0.0
    counted = 0
    for a in color_moves:
        if a.classification in ("book", "forced"):
            continue  # Don't count book/forced in accuracy
        counted += 1
        if a.classification == "best":
            total_score += 100.0
        else:
            # Scale: 0 cp loss = 100%, 200+ cp loss = 0%
            move_score = max(0.0, 100.0 - a.score_loss * 0.5)
            total_score += move_score

    if counted == 0:
        return 100.0
    return round(total_score / counted, 1)


# ─── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/review", response_model=ReviewResponse)
async def review_game(request: ReviewRequest):
    """Analyze every move in a game using Stockfish."""

    if not is_available():
        raise HTTPException(
            status_code=503,
            detail="Stockfish not installed. Place stockfish binary in backend/stockfish/ directory."
        )

    if len(request.moves) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 moves to review")

    if len(request.moves) > 500:
        raise HTTPException(status_code=400, detail="Too many moves (max 500)")

    board = chess.Board()
    analyses: list[MoveAnalysis] = []
    depth = request.depth

    # Evaluate the starting position
    start_eval = evaluate(board.fen(), depth)
    if start_eval is None:
        raise HTTPException(status_code=500, detail="Stockfish evaluation failed")

    prev_score = start_eval["score_cp"]
    prev_mate = start_eval["mate_in"]

    print(f"[Review] Analyzing {len(request.moves)} moves at depth {depth}...")

    for i, san_move in enumerate(request.moves):
        move_number = (i // 2) + 1
        color = "white" if i % 2 == 0 else "black"
        is_book = move_number <= BOOK_MOVES

        # Get engine's best move before making the player's move
        best_eval = evaluate(board.fen(), depth)
        if best_eval is None:
            raise HTTPException(status_code=500, detail=f"Stockfish failed at move {i+1}")

        engine_best_uci = best_eval["best_move"]

        # Count legal moves to detect forced moves
        legal_count = len(list(board.legal_moves))
        is_forced = legal_count == 1

        # Make the player's move
        try:
            move = board.parse_san(san_move)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid move at index {i}: {san_move}")

        # Check if the player's move matches the engine's best
        player_uci = move.uci()
        is_best_move = player_uci == engine_best_uci

        board.push(move)

        # Evaluate the position after the player's move
        if board.is_game_over(claim_draw=True):
            # Terminal position — assign score based on result
            if board.is_checkmate():
                # Side that just moved delivered checkmate
                after_score = 10000 if color == "white" else -10000
            else:
                after_score = 0  # Draw
            after_mate = None
        else:
            after_eval = evaluate(board.fen(), depth)
            if after_eval is None:
                raise HTTPException(status_code=500, detail=f"Stockfish failed after move {i+1}")
            after_score = after_eval["score_cp"]
            after_mate = after_eval["mate_in"]

        # Calculate centipawn loss from the mover's perspective:
        # For White: loss = score_before - score_after (positive = bad move)
        # For Black: loss = score_after - score_before (since lower is better for Black)
        if color == "white":
            cp_loss = max(0, prev_score - after_score)
        else:
            cp_loss = max(0, after_score - prev_score)

        # Convert engine best move to SAN for display
        best_san = None
        if not is_best_move and engine_best_uci:
            try:
                # Need to go back to the position before the move
                board.pop()
                best_move_obj = chess.Move.from_uci(engine_best_uci)
                if best_move_obj in board.legal_moves:
                    best_san = board.san(best_move_obj)
                board.push(move)
            except Exception:
                best_san = engine_best_uci  # Fallback to UCI

        classification = classify_move(cp_loss, is_best_move, is_book, is_forced)

        analyses.append(MoveAnalysis(
            move=san_move,
            move_number=move_number,
            color=color,
            classification=classification,
            score_before=prev_score,
            score_after=after_score,
            score_loss=int(cp_loss),
            best_move=best_san,
            mate_before=prev_mate,
            mate_after=after_mate,
        ))

        prev_score = after_score
        prev_mate = after_mate

        if (i + 1) % 10 == 0:
            print(f"  [{i+1}/{len(request.moves)}] moves analyzed...")

    # Calculate accuracy
    accuracy = AccuracyStats(
        white=calculate_accuracy(analyses, "white"),
        black=calculate_accuracy(analyses, "black"),
    )

    print(f"[Review] Complete. White accuracy: {accuracy.white}%, Black accuracy: {accuracy.black}%")

    return ReviewResponse(analysis=analyses, accuracy=accuracy)
