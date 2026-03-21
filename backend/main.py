"""
Chess Backend — FastAPI application.

Provides REST API endpoints for AI chess engines.
Start with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS
from engines.random_engine import RandomEngine
from engines.material_engine import MaterialEngine
from engines.minimax_engine import MinimaxEngine
from engines.mcts_engine import MCTSEngine
from engines.nn_engine import discover_models
from routers import moves, models, evaluate, tournament_games, puzzles, review

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
register_engine(MaterialEngine())
register_engine(MinimaxEngine(depth=3))
register_engine(MinimaxEngine(depth=5))
register_engine(MCTSEngine(simulations=800))

# Auto-discover trained neural network models
nn_engines = discover_models()
for nn_engine in nn_engines:
    register_engine(nn_engine)

print(f"Total engines: {len(engine_registry)}\n")

# Share the registry with routers
moves.engine_registry = engine_registry
models.engine_registry = engine_registry

# ─── Routes ───────────────────────────────────────────────────────────────────

app.include_router(moves.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(evaluate.router, prefix="/api")
app.include_router(tournament_games.router, prefix="/api")
app.include_router(puzzles.router, prefix="/api")
app.include_router(review.router, prefix="/api")

# Load puzzle database
puzzles.load_puzzles()

# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    from engines.stockfish_eval import is_available as sf_available
    return {
        "status": "ok",
        "engines": len(engine_registry),
        "stockfish": sf_available(),
    }


# ─── Shutdown ─────────────────────────────────────────────────────────────────

@app.on_event("shutdown")
async def shutdown():
    """Cleanly close external engine processes."""
    from engines.stockfish_eval import shutdown as sf_shutdown
    sf_shutdown()
