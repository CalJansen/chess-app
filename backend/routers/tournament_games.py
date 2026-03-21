"""
Tournament Games endpoint — serves saved tournament game replays.

GET /api/tournament-games -> list of saved games from tournaments
"""

import json
import os
from fastapi import APIRouter

router = APIRouter()

GAMES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "tournament_games"
)


@router.get("/tournament-games")
async def get_tournament_games():
    """Return all saved tournament games, newest first."""
    all_games = []

    if not os.path.isdir(GAMES_DIR):
        return all_games

    for filename in sorted(os.listdir(GAMES_DIR), reverse=True):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(GAMES_DIR, filename)
        try:
            with open(filepath) as f:
                games = json.load(f)
            all_games.extend(games)
        except (json.JSONDecodeError, IOError):
            continue

    return all_games
