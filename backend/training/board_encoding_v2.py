"""
Board Encoding v2 — Enhanced chess position representation.

Extends the original 18-plane encoding with additional feature planes that
capture tactical and strategic patterns the network would otherwise have
to learn implicitly:

  Planes  0-11:  Piece placement (same as v1)
  Plane  12-15:  Castling rights (same as v1)
  Plane  16:     En passant square (same as v1)
  Plane  17:     Side to move (same as v1)
  --- New planes below ---
  Plane  18:     White attacks (squares attacked by any white piece)
  Plane  19:     Black attacks (squares attacked by any black piece)
  Plane  20:     White pawn structure (supported pawns = 1)
  Plane  21:     Black pawn structure (supported pawns = 1)
  Plane  22:     Center control (d4/d5/e4/e5 weighted by piece/attack presence)
  Plane  23:     King safety (opponent attacks near each king)
  Plane  24:     Material imbalance (all squares, scaled by material diff / 39)
  Plane  25:     Mobility (all squares, scaled by legal move count / 50)

Why add these?
  The original 18 planes only encode *what pieces are where*. The network
  has to learn from scratch that controlling the center matters, that king
  safety is important, etc. By providing these features directly, we give
  the network a head start — it can learn *how much* these factors matter
  rather than having to discover they exist at all.

  This is a common technique in ML: feature engineering reduces the amount
  of learning the model needs to do, especially with smaller datasets.
"""

import numpy as np
import chess

NUM_PLANES_V2 = 26

# Piece values for material calculation
PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}

# Map piece types to plane indices (same as v1)
PIECE_PLANE = {
    chess.PAWN: 0,
    chess.KNIGHT: 1,
    chess.BISHOP: 2,
    chess.ROOK: 3,
    chess.QUEEN: 4,
    chess.KING: 5,
}

# Center squares
CENTER_SQUARES = [chess.D4, chess.D5, chess.E4, chess.E5]
EXTENDED_CENTER = [chess.C3, chess.C4, chess.C5, chess.C6,
                   chess.D3, chess.D6, chess.E3, chess.E6,
                   chess.F3, chess.F4, chess.F5, chess.F6]


def encode_board_v2(board: chess.Board) -> np.ndarray:
    """
    Encode a chess.Board as a 26x8x8 numpy array of float32.

    The first 18 planes are identical to v1. Planes 18-25 add
    tactical/strategic features.
    """
    planes = np.zeros((NUM_PLANES_V2, 8, 8), dtype=np.float32)

    # ── Planes 0-11: Piece placement (same as v1) ──
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece is None:
            continue
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        plane_offset = 0 if piece.color == chess.WHITE else 6
        plane_idx = plane_offset + PIECE_PLANE[piece.piece_type]
        planes[plane_idx, rank, file] = 1.0

    # ── Planes 12-15: Castling rights (same as v1) ──
    if board.has_kingside_castling_rights(chess.WHITE):
        planes[12, :, :] = 1.0
    if board.has_queenside_castling_rights(chess.WHITE):
        planes[13, :, :] = 1.0
    if board.has_kingside_castling_rights(chess.BLACK):
        planes[14, :, :] = 1.0
    if board.has_queenside_castling_rights(chess.BLACK):
        planes[15, :, :] = 1.0

    # ── Plane 16: En passant (same as v1) ──
    if board.ep_square is not None:
        rank = chess.square_rank(board.ep_square)
        file = chess.square_file(board.ep_square)
        planes[16, rank, file] = 1.0

    # ── Plane 17: Side to move (same as v1) ──
    if board.turn == chess.WHITE:
        planes[17, :, :] = 1.0

    # ── Plane 18-19: Attack maps ──
    for square in chess.SQUARES:
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        if board.is_attacked_by(chess.WHITE, square):
            planes[18, rank, file] = 1.0
        if board.is_attacked_by(chess.BLACK, square):
            planes[19, rank, file] = 1.0

    # ── Plane 20-21: Pawn structure (supported pawns) ──
    for color, plane_idx in [(chess.WHITE, 20), (chess.BLACK, 21)]:
        pawns = board.pieces(chess.PAWN, color)
        for sq in pawns:
            rank = chess.square_rank(sq)
            file = chess.square_file(sq)
            # Check if pawn is supported by an adjacent friendly pawn
            support_rank = rank - 1 if color == chess.WHITE else rank + 1
            if 0 <= support_rank <= 7:
                for df in [-1, 1]:
                    f = file + df
                    if 0 <= f <= 7:
                        adj_sq = chess.square(f, support_rank)
                        p = board.piece_at(adj_sq)
                        if p and p.piece_type == chess.PAWN and p.color == color:
                            planes[plane_idx, rank, file] = 1.0
                            break

    # ── Plane 22: Center control ──
    for sq in CENTER_SQUARES:
        rank = chess.square_rank(sq)
        file = chess.square_file(sq)
        piece = board.piece_at(sq)
        value = 0.0
        if piece and piece.color == chess.WHITE:
            value = 1.0
        elif piece and piece.color == chess.BLACK:
            value = -1.0
        else:
            white_attacks = board.is_attacked_by(chess.WHITE, sq)
            black_attacks = board.is_attacked_by(chess.BLACK, sq)
            if white_attacks and not black_attacks:
                value = 0.5
            elif black_attacks and not white_attacks:
                value = -0.5
        planes[22, rank, file] = (value + 1.0) / 2.0

    for sq in EXTENDED_CENTER:
        if sq in CENTER_SQUARES:
            continue
        rank = chess.square_rank(sq)
        file = chess.square_file(sq)
        white_attacks = board.is_attacked_by(chess.WHITE, sq)
        black_attacks = board.is_attacked_by(chess.BLACK, sq)
        value = 0.0
        if white_attacks and not black_attacks:
            value = 0.3
        elif black_attacks and not white_attacks:
            value = -0.3
        planes[22, rank, file] = (value + 1.0) / 2.0

    # ── Plane 23: King safety ──
    for color in [chess.WHITE, chess.BLACK]:
        king_sq = board.king(color)
        if king_sq is None:
            continue
        opponent = not color
        king_rank = chess.square_rank(king_sq)
        king_file = chess.square_file(king_sq)
        for dr in [-1, 0, 1]:
            for df in [-1, 0, 1]:
                if dr == 0 and df == 0:
                    continue
                r, f = king_rank + dr, king_file + df
                if 0 <= r <= 7 and 0 <= f <= 7:
                    sq = chess.square(f, r)
                    if board.is_attacked_by(opponent, sq):
                        val = 1.0 if color == chess.WHITE else -1.0
                        planes[23, r, f] = (val + 1.0) / 2.0

    # ── Plane 24: Material imbalance ──
    white_material = sum(
        PIECE_VALUES[p] * len(board.pieces(p, chess.WHITE))
        for p in PIECE_VALUES
    )
    black_material = sum(
        PIECE_VALUES[p] * len(board.pieces(p, chess.BLACK))
        for p in PIECE_VALUES
    )
    imbalance = (white_material - black_material) / 39.0
    planes[24, :, :] = (imbalance + 1.0) / 2.0

    # ── Plane 25: Mobility ──
    legal_count = len(list(board.legal_moves))
    planes[25, :, :] = min(legal_count / 50.0, 1.0)

    return planes
