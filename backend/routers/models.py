"""
Models endpoint — lists all available engines.

GET /api/models
  Response: [{ "name": "random", "description": "...", "type": "classical" }]
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Shared reference to the engine registry (set by main.py)
engine_registry: dict = {}


class ModelInfo(BaseModel):
    name: str
    description: str
    type: str


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """List all available chess engines."""
    return [
        ModelInfo(
            name=engine.name,
            description=engine.description,
            type=engine.engine_type,
        )
        for engine in engine_registry.values()
    ]
