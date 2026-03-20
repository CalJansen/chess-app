"""
Board Encoding — Converts chess positions to neural network input tensors.

The encoding uses 18 planes of 8x8:
  - Planes  0-5:  White pieces (pawn, knight, bishop, rook, queen, king)
  - Planes  6-11: Black pieces (pawn, knight, bishop, rook, queen, king)
  - Plane  12:    White kingside castling rights
  - Plane  13:    White queenside castling rights
  - Plane  14:    Black kingside castling rights
  - Plane  15:    Black queenside castling rights
  - Plane  16:    En passant square (1 on the target square, 0 elsewhere)
  - Plane  17:    Side to move (all 1s if white to move, all 0s if black)

Each square maps to (rank, file) where rank 0 = rank 1 (a1 side)
and file 0 = a-file. This matches python-chess square indexing.
"""

import numpy as np
import chess

NUM_PLANES = 18

# Map piece types to plane indices (0-based)
PIECE_PLANE = {
    chess.PAWN: 0,
    chess.KNIGHT: 1,
    chess.BISHOP: 2,
    chess.ROOK: 3,
    chess.QUEEN: 4,
    chess.KING: 5,
}


def encode_board(board: chess.Board) -> np.ndarray:
    """
    Encode a chess.Board as an 18x8x8 numpy array of float32.

    This is the representation the neural network sees. Each plane is a
    binary (0/1) grid showing where specific features are on the board.
    """
    planes = np.zeros((NUM_PLANES, 8, 8), dtype=np.float32)

    # Piece planes (0-11)
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece is None:
            continue
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        plane_offset = 0 if piece.color == chess.WHITE else 6
        plane_idx = plane_offset + PIECE_PLANE[piece.piece_type]
        planes[plane_idx, rank, file] = 1.0

    # Castling rights (planes 12-15)
    if board.has_kingside_castling_rights(chess.WHITE):
        planes[12, :, :] = 1.0
    if board.has_queenside_castling_rights(chess.WHITE):
        planes[13, :, :] = 1.0
    if board.has_kingside_castling_rights(chess.BLACK):
        planes[14, :, :] = 1.0
    if board.has_queenside_castling_rights(chess.BLACK):
        planes[15, :, :] = 1.0

    # En passant (plane 16)
    if board.ep_square is not None:
        rank = chess.square_rank(board.ep_square)
        file = chess.square_file(board.ep_square)
        planes[16, rank, file] = 1.0

    # Side to move (plane 17)
    if board.turn == chess.WHITE:
        planes[17, :, :] = 1.0

    return planes
