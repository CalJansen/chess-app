"""
Configuration settings for the chess backend.
"""

# Server
HOST = "0.0.0.0"
PORT = 8000

# Paths
MODEL_DIR = "models"
STOCKFISH_DIR = "stockfish"

# CORS - allowed frontend origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
