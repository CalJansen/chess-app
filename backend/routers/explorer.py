"""
Lichess Opening Explorer proxy.

Proxies requests to the Lichess Explorer API with server-side authentication
so the API token is never exposed to the browser.
"""

import os
import httpx
from fastapi import APIRouter, Query

router = APIRouter()

LICHESS_EXPLORER_URL = "https://explorer.lichess.ovh/lichess"
LICHESS_TOKEN = os.environ.get("LICHESS_API_TOKEN", "")


@router.get("/explorer")
async def explorer_proxy(
    fen: str = Query(..., description="FEN string for the position"),
    speeds: str = Query("blitz,rapid,classical", description="Comma-separated speeds"),
    ratings: str = Query("1600,1800,2000,2200,2500", description="Comma-separated ratings"),
):
    """Proxy to Lichess Opening Explorer API."""
    headers = {}
    if LICHESS_TOKEN:
        headers["Authorization"] = f"Bearer {LICHESS_TOKEN}"

    params = {"fen": fen, "speeds": speeds, "ratings": ratings}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(LICHESS_EXPLORER_URL, params=params, headers=headers)

    if resp.status_code != 200:
        return {"white": 0, "draws": 0, "black": 0, "moves": [], "opening": None}

    return resp.json()
