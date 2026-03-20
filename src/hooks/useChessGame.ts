"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Chess, Square, Move } from "chess.js";
import { saveGame, loadGame, clearGame } from "@/utils/storage";

export interface CapturedPieces {
  white: string[];
  black: string[];
}

const PIECE_UNICODE: Record<string, string> = {
  wp: "\u2659",
  wn: "\u2658",
  wb: "\u2657",
  wr: "\u2656",
  wq: "\u2655",
  wk: "\u2654",
  bp: "\u265F",
  bn: "\u265E",
  bb: "\u265D",
  br: "\u265C",
  bq: "\u265B",
  bk: "\u265A",
};

export function useChessGame() {
  const gameRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(gameRef.current.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [initialized, setInitialized] = useState(false);

  // Load saved game on mount
  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      const game = new Chess();
      for (const san of saved.history) {
        game.move(san);
      }
      gameRef.current = game;
      setFen(game.fen());
      setMoveHistory(saved.history);
    }
    setInitialized(true);
  }, []);

  // Save game state whenever it changes
  useEffect(() => {
    if (!initialized) return;
    saveGame({ fen, history: moveHistory });
  }, [fen, moveHistory, initialized]);

  const game = gameRef.current;

  const syncState = useCallback(() => {
    setFen(game.fen());
    setMoveHistory(game.history());
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [game]);

  const getStatus = useCallback((): string => {
    if (game.isCheckmate()) {
      const winner = game.turn() === "w" ? "Black" : "White";
      return `Checkmate! ${winner} wins!`;
    }
    if (game.isStalemate()) return "Stalemate! Draw.";
    if (game.isThreefoldRepetition()) return "Draw by threefold repetition.";
    if (game.isInsufficientMaterial()) return "Draw by insufficient material.";
    if (game.isDraw()) return "Draw!";
    const turn = game.turn() === "w" ? "White" : "Black";
    if (game.inCheck()) return `${turn} is in check!`;
    return `${turn} to move`;
  }, [game]);

  const getCapturedPieces = useCallback((): CapturedPieces => {
    const captured: CapturedPieces = { white: [], black: [] };
    const history = game.history({ verbose: true }) as Move[];
    for (const move of history) {
      if (move.captured) {
        const capturedColor = move.color === "w" ? "b" : "w";
        const key = `${capturedColor}${move.captured}`;
        const symbol = PIECE_UNICODE[key] || move.captured;
        if (move.color === "w") {
          captured.white.push(symbol);
        } else {
          captured.black.push(symbol);
        }
      }
    }
    return captured;
  }, [game]);

  const getLegalMovesForSquare = useCallback(
    (square: string): string[] => {
      const moves = game.moves({ square: square as Square, verbose: true }) as Move[];
      return moves.map((m) => m.to);
    },
    [game]
  );

  const makeMove = useCallback(
    (from: string, to: string): boolean => {
      try {
        game.move({ from: from as Square, to: to as Square, promotion: "q" });
        syncState();
        return true;
      } catch {
        return false;
      }
    },
    [game, syncState]
  );

  const onSquareClick = useCallback(
    (square: string, piece: string | null) => {
      if (game.isGameOver()) return;

      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
        if (legalMoves.includes(square)) {
          makeMove(selectedSquare, square);
          return;
        }
      }

      if (piece) {
        const pieceColor = piece.charAt(0);
        if (
          (game.turn() === "w" && pieceColor === "w") ||
          (game.turn() === "b" && pieceColor === "b")
        ) {
          setSelectedSquare(square);
          setLegalMoves(getLegalMovesForSquare(square));
          return;
        }
      }

      setSelectedSquare(null);
      setLegalMoves([]);
    },
    [game, selectedSquare, legalMoves, makeMove, getLegalMovesForSquare]
  );

  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (game.isGameOver()) return false;
      setSelectedSquare(null);
      setLegalMoves([]);
      return makeMove(sourceSquare, targetSquare);
    },
    [game, makeMove]
  );

  const onPieceDragBegin = useCallback(
    (square: string) => {
      if (game.isGameOver()) return;
      setSelectedSquare(square);
      setLegalMoves(getLegalMovesForSquare(square));
    },
    [game, getLegalMovesForSquare]
  );

  const undoMove = useCallback(() => {
    game.undo();
    syncState();
  }, [game, syncState]);

  const flipBoard = useCallback(() => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  }, []);

  const newGame = useCallback(() => {
    game.reset();
    syncState();
    clearGame();
  }, [game, syncState]);

  const isGameOver = game.isGameOver();

  // Build square styles for highlights
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    squareStyles[selectedSquare] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
  }
  for (const sq of legalMoves) {
    const targetPiece = game.get(sq as Square);
    if (targetPiece) {
      squareStyles[sq] = {
        background: "radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.3) 55%)",
      };
    } else {
      squareStyles[sq] = {
        background: "radial-gradient(circle, rgba(0, 0, 0, 0.25) 25%, transparent 25%)",
      };
    }
  }

  return {
    fen,
    selectedSquare,
    legalMoves,
    moveHistory,
    boardOrientation,
    squareStyles,
    isGameOver,
    initialized,
    getStatus,
    getCapturedPieces,
    onSquareClick,
    onPieceDrop,
    onPieceDragBegin,
    undoMove,
    flipBoard,
    newGame,
  };
}
