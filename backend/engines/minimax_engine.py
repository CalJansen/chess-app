"""
Minimax Engine — Level 3: Minimax search with alpha-beta pruning.

Strategy: Look several moves ahead using the minimax algorithm, then pick
the move that leads to the best guaranteed outcome. Alpha-beta pruning
dramatically reduces the number of positions we need to evaluate.

Key concepts:
  - Minimax: Assume both players play optimally. The maximizing player
    picks the move with the highest score; the minimizing player picks
    the move with the lowest score. We alternate until we reach our
    search depth limit.

  - Alpha-Beta Pruning: If we already know a branch can't possibly be
    better than one we've already found, we skip it entirely. This lets
    us search roughly twice as deep in the same time.

  - Move Ordering: Evaluating captures and checks first dramatically
    improves pruning efficiency. MVV-LVA (Most Valuable Victim - Least
    Valuable Attacker) is a simple but effective ordering heuristic.

  - Piece-Square Tables: Beyond just counting material, we give bonuses/
    penalties based on WHERE pieces are. Knights are better in the center,
    kings should castle early, pawns should advance, etc.

Expected strength:
  - Depth 3: ~1200-1400 Elo (club player level, fast responses)
  - Depth 5: ~1600-1800 Elo (strong club player, 2-5 seconds per move)
"""

import random
import time
import chess
from .base import ChessEngine


# ─── Piece Values (centipawns) ─────────────────────────────────────────────────

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000,  # Very high so checkmate is always prioritized
}

# ─── Piece-Square Tables ──────────────────────────────────────────────────────
# These tables give positional bonuses (in centipawns) for each piece on each
# square. Values are from White's perspective (a1=index 0, h8=index 63).
# Black's tables are mirrored vertically.
#
# Source: Simplified evaluation function from chessprogramming.org

PAWN_TABLE = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
]

KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
]

BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
]

ROOK_TABLE = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
]

QUEEN_TABLE = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
]

KING_MIDDLEGAME_TABLE = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
]

# Map piece types to their tables
PST = {
    chess.PAWN: PAWN_TABLE,
    chess.KNIGHT: KNIGHT_TABLE,
    chess.BISHOP: BISHOP_TABLE,
    chess.ROOK: ROOK_TABLE,
    chess.QUEEN: QUEEN_TABLE,
    chess.KING: KING_MIDDLEGAME_TABLE,
}


# ─── Evaluation Function ──────────────────────────────────────────────────────

def evaluate(board: chess.Board) -> int:
    """
    Evaluate a position from White's perspective.

    Combines material counting with positional bonuses from piece-square tables.
    Also handles checkmate/stalemate detection.

    Returns: score in centipawns (positive = good for white)
    """
    # Terminal positions
    if board.is_checkmate():
        # The side to move is checkmated → they lose
        return -99999 if board.turn == chess.WHITE else 99999
    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece is None:
            continue

        # Material value
        value = PIECE_VALUES.get(piece.piece_type, 0)

        # Positional bonus from piece-square table
        pst = PST.get(piece.piece_type)
        if pst:
            if piece.color == chess.WHITE:
                # White's table is read normally (a1=56 in the visual layout)
                # python-chess square indices: a1=0, h8=63
                # Our tables are laid out rank 8 first (index 0) to rank 1 (index 63)
                # For white: mirror the square vertically
                table_index = (7 - chess.square_rank(square)) * 8 + chess.square_file(square)
                value += pst[table_index]
            else:
                # Black's table: use the square index directly (already mirrored)
                table_index = chess.square_rank(square) * 8 + chess.square_file(square)
                value += pst[table_index]

        # Add or subtract based on piece color
        if piece.color == chess.WHITE:
            score += value
        else:
            score -= value

    return score


# ─── Move Ordering ─────────────────────────────────────────────────────────────

def order_moves(board: chess.Board) -> list:
    """
    Order moves to improve alpha-beta pruning.

    Good move ordering means we find the best move early, which causes
    more branches to be pruned. We use MVV-LVA (Most Valuable Victim -
    Least Valuable Attacker) for captures, and prioritize checks.

    Order: captures (sorted by MVV-LVA) → checks → quiet moves
    """
    captures = []
    checks = []
    quiet = []

    for move in board.legal_moves:
        if board.is_capture(move):
            # MVV-LVA: prioritize capturing valuable pieces with cheap pieces
            victim_value = 0
            attacker_value = 0
            victim = board.piece_at(move.to_square)
            attacker = board.piece_at(move.from_square)
            if victim:
                victim_value = PIECE_VALUES.get(victim.piece_type, 0)
            if attacker:
                attacker_value = PIECE_VALUES.get(attacker.piece_type, 0)
            mvv_lva_score = victim_value * 10 - attacker_value
            captures.append((mvv_lva_score, move))
        elif board.gives_check(move):
            checks.append(move)
        else:
            quiet.append(move)

    # Sort captures by MVV-LVA score (highest first)
    captures.sort(key=lambda x: x[0], reverse=True)

    return [m for _, m in captures] + checks + quiet


# ─── Minimax with Alpha-Beta ──────────────────────────────────────────────────

def minimax(board: chess.Board, depth: int, alpha: float, beta: float,
            maximizing: bool, stats: dict) -> int:
    """
    Minimax search with alpha-beta pruning.

    Args:
        board: Current position
        depth: How many half-moves (plies) to search ahead
        alpha: Best score the maximizer can guarantee (starts at -infinity)
        beta: Best score the minimizer can guarantee (starts at +infinity)
        maximizing: True if it's the maximizing player's turn (white)
        stats: Dict to track search statistics (nodes evaluated, etc.)

    Returns:
        The evaluation score for this position (from white's perspective)

    How alpha-beta pruning works:
        Alpha = "I (the maximizer) already have a move that guarantees me
                at least this score. I won't accept anything worse."
        Beta  = "My opponent (the minimizer) already has a move that
                guarantees them at most this score. They won't allow
                anything better for me."

        If alpha >= beta, we can stop searching this branch because one
        side already has a better option elsewhere. This is called a "cutoff".
    """
    stats["nodes"] += 1

    # Base case: reached our depth limit or the game is over
    if depth == 0 or board.is_game_over():
        return evaluate(board)

    ordered_moves = order_moves(board)

    if maximizing:
        max_eval = float("-inf")
        for move in ordered_moves:
            board.push(move)
            eval_score = minimax(board, depth - 1, alpha, beta, False, stats)
            board.pop()
            max_eval = max(max_eval, eval_score)
            alpha = max(alpha, eval_score)
            if beta <= alpha:
                stats["cutoffs"] += 1
                break  # Beta cutoff — minimizer won't allow this
        return max_eval
    else:
        min_eval = float("inf")
        for move in ordered_moves:
            board.push(move)
            eval_score = minimax(board, depth - 1, alpha, beta, True, stats)
            board.pop()
            min_eval = min(min_eval, eval_score)
            beta = min(beta, eval_score)
            if beta <= alpha:
                stats["cutoffs"] += 1
                break  # Alpha cutoff — maximizer already has something better
        return min_eval


# ─── Engine Class ──────────────────────────────────────────────────────────────

class MinimaxEngine(ChessEngine):
    """
    Minimax engine with alpha-beta pruning and piece-square tables.

    Searches to a configurable depth, evaluates positions using material +
    positional factors, and uses move ordering to maximize pruning.
    """

    def __init__(self, depth: int = 3):
        self._depth = depth

    @property
    def name(self) -> str:
        return f"minimax-d{self._depth}"

    @property
    def description(self) -> str:
        return f"Minimax with alpha-beta pruning, depth {self._depth} -- material + positional evaluation."

    def select_move(self, board: chess.Board) -> chess.Move:
        start_time = time.time()
        stats = {"nodes": 0, "cutoffs": 0}

        best_score = float("-inf") if board.turn == chess.WHITE else float("inf")
        best_moves = []
        is_maximizing = board.turn == chess.WHITE

        ordered_moves = order_moves(board)

        for move in ordered_moves:
            board.push(move)
            score = minimax(
                board,
                self._depth - 1,
                float("-inf"),
                float("inf"),
                not is_maximizing,
                stats,
            )
            board.pop()

            if is_maximizing:
                if score > best_score:
                    best_score = score
                    best_moves = [move]
                elif score == best_score:
                    best_moves.append(move)
            else:
                if score < best_score:
                    best_score = score
                    best_moves = [move]
                elif score == best_score:
                    best_moves.append(move)

        elapsed = time.time() - start_time
        print(
            f"  [{self.name}] depth={self._depth} | "
            f"nodes={stats['nodes']:,} | cutoffs={stats['cutoffs']:,} | "
            f"score={best_score} | time={elapsed:.2f}s"
        )

        return random.choice(best_moves)
