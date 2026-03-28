# Chess App

A chess application with multiple AI engines, built with Next.js and Python FastAPI.

## Prerequisites

- **Node.js** (v18+)
- **Python 3.11** (install via `py install 3.11` on Windows)

## Quick Start

```bash
# 1. Install frontend dependencies
npm install

# 2. Start the frontend (http://localhost:3000)
npm run dev

# 3. Set up the backend (in a separate terminal)
cd backend
py -3.11 -m venv venv
venv\Scripts\pip.exe install -r requirements.txt
venv\Scripts\pip.exe install torch --index-url https://download.pytorch.org/whl/cu128

# 4. Start the backend (http://localhost:8000)
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

> For CPU-only PyTorch (no NVIDIA GPU), replace `cu128` with `cpu` in the torch install command.

## Commands

### Frontend

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm run start
```

### Backend

All backend commands should be run from the `backend/` directory.

```bash
# Start the backend server
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# Health check
curl http://localhost:8000/api/health

# List available engines
curl http://localhost:8000/api/models
```

### Stockfish Analysis (Optional)

Download Stockfish to enable the evaluation bar and best-move arrows.

1. Go to [stockfishchess.org/download](https://stockfishchess.org/download/)
2. Download the Windows binary (`.zip` file)
3. Extract and place the `.exe` in `backend/stockfish/`
4. Restart the backend — Stockfish is auto-detected at startup

```bash
# Verify Stockfish is loaded
curl http://localhost:8000/api/evaluate/status

# Evaluate a position
curl -X POST http://localhost:8000/api/evaluate -H "Content-Type: application/json" -d "{\"fen\":\"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\"}"
```

### Chess Puzzles

Download and solve chess puzzles from the Lichess puzzle database (4M+ puzzles).

```bash
# Download 50K puzzles (default)
venv\Scripts\python.exe -u -m training.download_puzzles

# Filter by rating and theme
venv\Scripts\python.exe -u -m training.download_puzzles --max-puzzles 100000 --min-rating 1200 --max-rating 2000

# Filter by specific themes
venv\Scripts\python.exe -u -m training.download_puzzles --themes "mate fork pin"
```

Once downloaded, puzzles are available via the "Puzzles" button in the app. Filter by difficulty and theme, track your solve rate and streak.

### Training Pipeline

Train a neural network to evaluate chess positions using games from the Lichess open database.

```bash
# Step 1: Download games from Lichess
venv\Scripts\python.exe -u -m training.download_data --month 2013-01 --max-games 50000 --min-rating 1500

# Step 2: Prepare training tensors from the downloaded games
venv\Scripts\python.exe -u -m training.prepare_dataset

# Step 3: Train the model
venv\Scripts\python.exe -u -m training.train --epochs 30 --batch-size 512

# Step 4: Evaluate the trained model
venv\Scripts\python.exe -u -m training.evaluate_model
```

Trained models (`.pt` files) are saved to `backend/models/` and auto-discovered when the backend starts.

#### Stockfish-Supervised Training (Recommended)

Train with Stockfish position evaluations instead of game outcomes for much better accuracy.

```bash
# Full pipeline: extract positions, label with Stockfish, train
venv\Scripts\python.exe -u -m training.train_stockfish --max-games 5000 --depth 12

# More data + deeper analysis (slower, better labels)
venv\Scripts\python.exe -u -m training.train_stockfish --max-games 10000 --depth 15

# Retrain with different hyperparameters (auto-reuses cached labels at data/sf_training_data.pt)
venv\Scripts\python.exe -u -m training.train_stockfish --lr 0.0003 --epochs 80

# Force re-extraction and re-labeling (ignores cached data)
venv\Scripts\python.exe -u -m training.train_stockfish --fresh-data --max-games 10000 --depth 15

# Use a specific labeled data file
venv\Scripts\python.exe -u -m training.train_stockfish --labeled-data data/sf_training_data.pt
```

> **Note:** Labeled data is automatically cached to `data/sf_training_data.pt`. On subsequent runs the script reuses this cache unless you pass `--fresh-data`. This avoids accidentally re-running hours of Stockfish labeling.

#### V2 Architecture (SE-ResNet + Enhanced Encoding)

Train a larger model with Squeeze-and-Excitation attention blocks and 26-plane board encoding (adds attack maps, pawn structure, king safety, center control, material imbalance, mobility). Data augmentation via horizontal board mirroring doubles the effective dataset size.

```bash
# Full pipeline: extract, label, train V2
venv\Scripts\python.exe -u -m training.train_v2 --max-games 5000 --depth 12

# Retrain with different hyperparameters (auto-reuses cached labels at data/sf_v2_training_data.pt)
venv\Scripts\python.exe -u -m training.train_v2 --lr 0.0003 --epochs 80

# Force re-extraction and re-labeling (ignores cached data)
venv\Scripts\python.exe -u -m training.train_v2 --fresh-data --max-games 50000 --depth 15

# Use a specific labeled data file
venv\Scripts\python.exe -u -m training.train_v2 --labeled-data data/sf_v2_training_data.pt

# Compare v1 vs v2 in a tournament
venv\Scripts\python.exe -u -m training.tournament --engines nn-chess_value_v2 nn-chess_value_sf_v1 minimax-d3 --games 20
```

> **Note:** V2 labeled data is cached separately from V1 (at `data/sf_v2_training_data.pt`) because V2 uses a different 26-plane encoding. The script auto-reuses cached data unless you pass `--fresh-data`.

#### Training Options

```bash
# Download from a different month (larger months = more games)
venv\Scripts\python.exe -u -m training.download_data --month 2015-06 --max-games 100000

# Prepare with custom sample rate (lower = smaller dataset, faster training)
venv\Scripts\python.exe -u -m training.prepare_dataset --sample-rate 0.15 --output data/training_data_small.pt

# Train with custom parameters
venv\Scripts\python.exe -u -m training.train \
  --data data/training_data.pt \
  --output models/chess_value_v2.pt \
  --epochs 50 \
  --batch-size 1024 \
  --lr 0.001 \
  --patience 8

# Evaluate a specific model
venv\Scripts\python.exe -u -m training.evaluate_model --model models/chess_value_v2.pt
```

### Engine Tournament

Compare engines by running automated matches between them.

```bash
# List all available engines
venv\Scripts\python.exe -u -m training.tournament --list

# Round-robin tournament (all engines, 10 games per pairing)
venv\Scripts\python.exe -u -m training.tournament --games 10

# Head-to-head between specific engines
venv\Scripts\python.exe -u -m training.tournament --engines nn-chess_value_v1 minimax-d3 material --games 20

# Verbose mode (show individual game results)
venv\Scripts\python.exe -u -m training.tournament --engines nn-chess_value_v1 nn-chess_value_v2 --games 30 -v

# Set time limit per move (default: 5 seconds)
venv\Scripts\python.exe -u -m training.tournament --time-limit 3 --games 10

# Disable saving sample games to disk
venv\Scripts\python.exe -u -m training.tournament --no-save-games --games 10
```

Tournament sample games are saved to `backend/data/tournament_games/` and can be replayed in the UI via the `/api/tournament-games` endpoint.

## AI Engines

| Engine | Type | Description |
|--------|------|-------------|
| `random` | Classical | Picks any legal move at random |
| `material` | Classical | Greedy material capture, depth-1 lookahead |
| `minimax-d3` | Classical | Minimax with alpha-beta pruning, depth 3 |
| `minimax-d5` | Classical | Minimax with alpha-beta pruning, depth 5 |
| `mcts` | Classical | Monte Carlo Tree Search, 800 simulations |
| `nn-*` | ML | Neural network evaluation + minimax depth 2 |

## Project Structure

```
chess-app/
├── src/                    # Next.js frontend
│   ├── components/         # React components (Board, ChessGame, etc.)
│   │   ├── panels/         # Tab panels (PlayPanel, ExplorerPanel, PuzzlePanel, HistoryPanel)
│   │   └── ...
│   ├── hooks/              # Custom hooks (useChessGame, useAIGame, useOpeningExplorer, etc.)
│   ├── contexts/           # Theme + AppMode contexts
│   ├── data/               # Opening databases (openings.json, openings-tree.json)
│   ├── services/           # API client, Lichess explorer client
│   └── utils/              # PGN, game history, openings utilities
├── backend/
│   ├── main.py             # FastAPI app entry point
│   ├── config.py           # CORS and app configuration
│   ├── .env                # API tokens (gitignored)
│   ├── engines/            # AI engine implementations
│   │   ├── base.py         # Abstract engine base class
│   │   ├── random_engine.py
│   │   ├── material_engine.py
│   │   ├── minimax_engine.py
│   │   ├── mcts_engine.py
│   │   ├── nn_model.py     # ResNet value networks (v1 + v2 SE-ResNet)
│   │   └── nn_engine.py    # NN-based engine + model auto-discovery
│   ├── training/           # ML training pipeline
│   │   ├── download_data.py
│   │   ├── prepare_dataset.py
│   │   ├── board_encoding.py      # V1: 18-plane encoding
│   │   ├── board_encoding_v2.py   # V2: 26-plane encoding (attacks, pawn structure, etc.)
│   │   ├── train.py               # Game-outcome training
│   │   ├── train_stockfish.py     # Stockfish-supervised training (v1)
│   │   ├── train_v2.py            # Stockfish-supervised training (v2 SE-ResNet)
│   │   ├── evaluate_model.py
│   │   └── tournament.py
│   ├── routers/            # API route handlers
│   │   └── explorer.py     # Lichess Explorer API proxy
│   ├── models/             # Trained .pt model files (gitignored)
│   └── data/               # Training data + cached labels (gitignored)
└── scripts/                # Build utilities (openings DB generator)
```
