"""
Puzzle endpoints -- serves chess puzzles from the Lichess database.

GET /api/puzzles/random  — returns a random puzzle matching filters
GET /api/puzzles/themes  — returns list of available puzzle themes
GET /api/puzzles/stats   — returns puzzle database statistics

Puzzles are loaded into memory from backend/data/puzzles.csv at startup.
Run `python -m training.download_puzzles` first to download the database.
"""

import csv
import os
import random
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


# ─── Data Model ──────────────────────────────────────────────────────────────

class Puzzle(BaseModel):
    id: str
    fen: str
    moves: list[str]       # UCI moves: first is setup, rest are solution
    rating: int
    themes: list[str]
    nb_plays: int
    popularity: int


# ─── In-Memory Puzzle Store ──────────────────────────────────────────────────

_puzzles: list[dict] = []
_themes_set: set = set()
_loaded = False

PUZZLES_CSV = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "puzzles.csv"
)


def load_puzzles():
    """Load puzzles from CSV into memory. Called once at startup."""
    global _puzzles, _themes_set, _loaded

    if _loaded:
        return

    if not os.path.isfile(PUZZLES_CSV):
        print("[Puzzles] No puzzle database found. Run: python -m training.download_puzzles")
        _loaded = True
        return

    print(f"[Puzzles] Loading puzzles from {PUZZLES_CSV}...")

    with open(PUZZLES_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                themes = row.get("Themes", "").split()
                puzzle = {
                    "id": row["PuzzleId"],
                    "fen": row["FEN"],
                    "moves": row["Moves"].split(),
                    "rating": int(row["Rating"]),
                    "themes": themes,
                    "nb_plays": int(row.get("NbPlays", 0)),
                    "popularity": int(row.get("Popularity", 0)),
                }
                _puzzles.append(puzzle)
                _themes_set.update(themes)
            except (KeyError, ValueError):
                continue

    _loaded = True
    print(f"[Puzzles] Loaded {len(_puzzles):,} puzzles with {len(_themes_set)} themes")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/puzzles/random", response_model=Puzzle)
async def get_random_puzzle(
    rating_min: int = Query(0, ge=0),
    rating_max: int = Query(9999, le=9999),
    theme: Optional[str] = Query(None, description="Filter by theme (e.g., 'fork', 'mate')"),
):
    """Get a random puzzle matching the given filters."""
    if not _puzzles:
        raise HTTPException(
            status_code=503,
            detail="No puzzles loaded. Run: python -m training.download_puzzles"
        )

    # Filter puzzles
    candidates = _puzzles
    if rating_min > 0 or rating_max < 9999:
        candidates = [p for p in candidates
                      if rating_min <= p["rating"] <= rating_max]

    if theme:
        theme_lower = theme.lower()
        candidates = [p for p in candidates
                      if theme_lower in [t.lower() for t in p["themes"]]]

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="No puzzles found matching the given filters"
        )

    puzzle = random.choice(candidates)
    return Puzzle(**puzzle)


@router.get("/puzzles/themes")
async def get_themes():
    """Get list of all available puzzle themes."""
    return sorted(_themes_set)


@router.get("/puzzles/stats")
async def get_stats():
    """Get puzzle database statistics."""
    if not _puzzles:
        return {"total": 0, "themes": 0, "loaded": _loaded}

    ratings = [p["rating"] for p in _puzzles]
    return {
        "total": len(_puzzles),
        "themes": len(_themes_set),
        "rating_min": min(ratings),
        "rating_max": max(ratings),
        "rating_avg": sum(ratings) // len(ratings),
        "loaded": True,
    }
