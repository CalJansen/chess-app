"use client";

import { useChessGame } from "@/hooks/useChessGame";
import Board from "./Board";
import GameStatus from "./GameStatus";
import GameControls from "./GameControls";
import MoveHistory from "./MoveHistory";
import CapturedPieces from "./CapturedPieces";

export default function ChessGame() {
  const {
    fen,
    boardOrientation,
    squareStyles,
    moveHistory,
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
  } = useChessGame();

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-5xl mx-auto min-h-screen items-center lg:items-start justify-center">
      {/* Board */}
      <div className="flex-shrink-0">
        <Board
          fen={fen}
          boardOrientation={boardOrientation}
          squareStyles={squareStyles}
          onSquareClick={onSquareClick}
          onPieceDrop={onPieceDrop}
          onPieceDragBegin={onPieceDragBegin}
        />
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-72 flex flex-col gap-4">
        <GameStatus status={getStatus()} isGameOver={isGameOver} />
        <GameControls
          onUndo={undoMove}
          onFlip={flipBoard}
          onNewGame={newGame}
          canUndo={moveHistory.length > 0}
        />
        <CapturedPieces captured={getCapturedPieces()} />
        <MoveHistory history={moveHistory} />
      </div>
    </div>
  );
}
