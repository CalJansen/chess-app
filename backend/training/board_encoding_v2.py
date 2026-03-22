"""
Board Encoding V2 — Enhanced 26-plane encoding for chess positions.

Extends the V1 encoding (18 planes) with 8 additional planes:

  - Planes  0-5:   White pieces (pawn, knight, bishop, rook, queen, king)
  - Planes  6-11:  Black pieces (pawn, knight, bishop, rook, queen, king)
  - Plane  12:     White kingside castling rights
  - Plane  13:     White queenside castling rights
  - Plane  14:     Black kingside castling rights
  - Plane  15:     Black queenside castling rights
  - Plane  16:     En passant square
  - Plane  17:     Side to move (1 = white, 0 = black)
  - Planes 18-19:  White/Black attack maps (squares attacked by each side)
  - Planes 20-21:  White/Black pawn structure (doubled/isolated pawn penalties)
  - Planes 22-23:  White/Black king zone (3x3 area around each king)
  - Plane  24:     Move count (normalized: min(fullmove, 100) / 100)
  - Plane  25:     Halfmove clock (normalized: min(halfmove, 100) / 100)
"""

import numpy as np
import chess

NUM_PLANES_V2 = 26

PIECE_PLANE = {
    chess.PAWN: 0,
    chess.KNIGHT: 1,
    chess.BISHOP: 2,
    chess.ROOK: 3,
    chess.QUEEN: 4,
    chess.KING: 5,
}


def encode_board_v2(board: chess.Board) -> np.ndarray:
    """
    Encode a chess.Board as a 26x8x8 numpy array of float32.
    """
    planes = np.zeros((NUM_PLANES_V2, 8, 8), dtype=np.float32)

    # Piece planes (0-11) — same as V1
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece is None:
            continue
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        plane_offset = 0 if piece.color == chess.WHITE else 6
        plane_idx = plane_offset + PIECE_PLANE[piece.piece_type]
        planes[plane_idx, rank, file] = 1.0

    # Castling rights (planes 12-15) — same as V1
    if board.has_kingside_castling_rights(chess.WHITE):
        planes[12, :, :] = 1.0
    if board.has_queenside_castling_rights(chess.WHITE):
        planes[13, :, :] = 1.0
    if board.has_kingside_castling_rights(chess.BLACK):
        planes[14, :, :] = 1.0
    if board.has_queenside_castling_rights(chess.BLACK):
        planes[15, :, :] = 1.0

    # En passant (plane 16) — same as V1
    if board.ep_square is not None:
        rank = chess.square_rank(board.ep_square)
        file = chess.square_file(board.ep_square)
        planes[16, rank, file] = 1.0

    # Side to move (plane 17) — same as V1
    if board.turn == chess.WHITE:
        planes[17, :, :] = 1.0

    # Attack maps (planes 18-19)
    for square in chess.SQUARES:
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        if board.is_attacked_by(chess.WHITE, square):
            planes[18, rank, file] = 1.0
        if board.is_attacked_by(chess.BLACK, square):
            planes[19, rank, file] = 1.0

    # Pawn structure — doubled/isolated pawns (planes 20-21)
    for color_idx, color in enumerate([chess.WHITE, chess.BLACK]):
        pawns = board.pieces(chess.PAWN, color)
        files_with_pawns = set()
        for sq in pawns:
            files_with_pawns.add(chess.square_file(sq))

        for sq in pawns:
            rank = chess.square_rank(sq)
            file = chess.square_file(sq)
            # Check for doubled pawns (another pawn on same file)
            same_file_pawns = [s for s in pawns if chess.square_file(s) == file and s != sq]
            if same_file_pawns:
                planes[20 + color_idx, rank, file] = 1.0
            # Check for isolated pawns (no friendly pawns on adjacent files)
            adjacent_files = []
            if file > 0:
                adjacent_files.append(file - 1)
            if file < 7:
                adjacent_files.append(file + 1)
            if not any(f in files_with_pawns for f in adjacent_files):
                planes[20 + color_idx, rank, file] = 1.0

    # King zone — 3x3 area around each king (planes 22-23)
    for color_idx, color in enumerate([chess.WHITE, chess.BLACK]):
        king_sq = board.king(color)
        if king_sq is not None:
            king_rank = chess.square_rank(king_sq)
            king_file = chess.square_file(king_sq)
            for dr in [-1, 0, 1]:
                for df in [-1, 0, 1]:
                    r, f = king_rank + dr, king_file + df
                    if 0 <= r < 8 and 0 <= f < 8:
                        planes[22 + color_idx, r, f] = 1.0

    # Move count — normalized (plane 24)
    planes[24, :, :] = min(board.fullmove_number, 100) / 100.0

    # Halfmove clock — normalized (plane 25)
    planes[25, :, :] = min(board.halfmove_clock, 100) / 100.0

    return planes
