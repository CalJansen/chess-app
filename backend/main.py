"""
Chess Backend — FastAPI application.

Provides REST API endpoints for AI chess engines.
Start with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS
from engines.random_engine import RandomEngine
from routers import moves, models

# ─── Create the FastAPI app ───────────────────────────────────────────────────

app = FastAPI(
    title="Chess AI Backend",
    description="REST API for chess engine moves and evaluation",
    version="0.1.0",
)

# ─── CORS (allow the Next.js frontend to call us) ────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Engine Registry ─────────────────────────────────────────────────────────
# All engines are instantiated here and shared with the routers.

engine_registry = {}


def register_engine(engine):
    """Add an engine to the registry."""
    engine_registry[engine.name] = engine
    print(f"  Registered engine: {engine.name} — {engine.description}")


# Register built-in engines
print("Registering chess engines...")
register_engine(RandomEngine())
print(f"Total engines: {len(engine_registry)}\n")

# Share the registry with routers
moves.engine_registry = engine_registry
models.engine_registry = engine_registry

# ─── Routes ───────────────────────────────────────────────────────────────────

app.include_router(moves.router, prefix="/api")
app.include_router(models.router, prefix="/api")


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "engines": len(engine_registry)}
