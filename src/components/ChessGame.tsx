"use client";

import { useState, useEffect, useCallback } from "react";
import { useChessGame } from "@/hooks/useChessGame";
import { useReplayMode } from "@/hooks/useReplayMode";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useChessClock } from "@/hooks/useChessClock";
import { saveCompletedGame } from "@/utils/gameHistory";
import { findOpening } from "@/utils/openings";
import Board from "./Board";
import GameStatus from "./GameStatus";
import GameControls from "./GameControls";
import MoveHistory from "./MoveHistory";
import CapturedPieces from "./CapturedPieces";
import ThemeSelector from "./ThemeSelector";
import OpeningLabel from "./OpeningLabel";
import ReplayControls from "./ReplayControls";
import GameHistoryPanel from "./GameHistoryPanel";
import PGNModal from "./PGNModal";
import SoundToggle from "./SoundToggle";
import ChessClock from "./ChessClock";

export default function ChessGame() {
  const chessGame = useChessGame();
  const replay = useReplayMode();
  const sound = useSoundEffects();
  const clock = useChessClock();

  const [showHistory, setShowHistory] = useState(false);
  const [showPGN, setShowPGN] = useState(false);
  const [gameEndSaved, setGameEndSaved] = useState(false);

  const {
    fen,
    boardOrientation,
    squareStyles,
    moveHistory,
    turn,
    isGameOver,
    currentOpening,
    lastMoveType,
    initialized,
    getStatus,
    getGameResult,
    getCapturedPieces,
    onSquareClick,
    onPieceDrop,
    onPieceDragBegin,
    undoMove,
    flipBoard,
    newGame,
  } = chessGame;

  // Play sound on each move
  useEffect(() => {
    if (lastMoveType) {
      sound.playSound(lastMoveType);
    }
  }, [lastMoveType, moveHistory.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch clock after each move
  useEffect(() => {
    if (moveHistory.length === 0) return;
    if (moveHistory.length === 1 && clock.isEnabled && !clock.isRunning) {
      // Start the clock on first move
      clock.startClock();
    }
    // The player who just moved is the opposite of current turn
    const justMoved = turn === "white" ? "black" : "white";
    clock.switchClock(justMoved as "white" | "black");
  }, [moveHistory.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save completed games
  useEffect(() => {
    if (isGameOver && !gameEndSaved && moveHistory.length > 0) {
      const opening = currentOpening ? `${currentOpening.eco}: ${currentOpening.name}` : "";
      saveCompletedGame({
        moves: moveHistory,
        result: getGameResult(),
        opening,
        whitePlayer: "Player 1",
        blackPlayer: "Player 2",
      });
      setGameEndSaved(true);
    }
  }, [isGameOver, gameEndSaved, moveHistory, currentOpening, getGameResult]);

  // Check for timeout
  const timeoutMessage = clock.whiteTimedOut
    ? "White ran out of time! Black wins!"
    : clock.blackTimedOut
    ? "Black ran out of time! White wins!"
    : null;

  // Handle new game with clock reset
  const handleNewGame = useCallback(() => {
    newGame();
    clock.resetClock();
    setGameEndSaved(false);
  }, [newGame, clock]);

  // Handle replay
  const handleStartReplay = useCallback(
    (moves: string[]) => {
      replay.startReplay(moves);
      setShowHistory(false);
    },
    [replay]
  );

  // Handle PGN import -> replay
  const handlePGNImport = useCallback(
    (moves: string[]) => {
      replay.startReplay(moves);
      setShowPGN(false);
    },
    [replay]
  );

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="opacity-40">Loading...</p>
      </div>
    );
  }

  // Determine which FEN and orientation to show
  const displayFen = replay.isActive ? replay.displayFen : fen;
  const displayOrientation = replay.isActive ? "white" : boardOrientation;
  const replayOpening = replay.isActive
    ? findOpening(replay.moves.slice(0, replay.currentIndex + 1))
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-5xl mx-auto min-h-screen items-center lg:items-start justify-center">
      {/* Board */}
      <div className="flex-shrink-0">
        <Board
          fen={displayFen}
          boardOrientation={displayOrientation}
          squareStyles={replay.isActive ? {} : squareStyles}
          onSquareClick={replay.isActive ? () => {} : onSquareClick}
          onPieceDrop={replay.isActive ? () => false : onPieceDrop}
          onPieceDragBegin={replay.isActive ? () => {} : onPieceDragBegin}
        />
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-72 flex flex-col gap-4">
        <ThemeSelector />

        <OpeningLabel opening={replay.isActive ? replayOpening : currentOpening} />

        {/* Clock */}
        {!replay.isActive && (
          <ChessClock
            whiteTime={clock.whiteTime}
            blackTime={clock.blackTime}
            activeColor={clock.activeColor}
            isEnabled={clock.isEnabled}
            timeControl={clock.timeControl}
            onSetTimeControl={clock.setTimeControl}
          />
        )}

        {/* Status */}
        {!replay.isActive && (
          <GameStatus
            status={timeoutMessage || getStatus()}
            isGameOver={isGameOver || !!timeoutMessage}
          />
        )}

        {/* Controls area */}
        {replay.isActive ? (
          <ReplayControls
            currentIndex={replay.currentIndex}
            totalMoves={replay.totalMoves}
            onStepBack={replay.stepBack}
            onStepForward={replay.stepForward}
            onGoToStart={replay.goToStart}
            onGoToEnd={replay.goToEnd}
            onGoToMove={replay.goToMove}
            onExit={replay.stopReplay}
          />
        ) : (
          <>
            <GameControls
              onUndo={undoMove}
              onFlip={flipBoard}
              onNewGame={handleNewGame}
              canUndo={moveHistory.length > 0}
            />
            <div className="flex flex-wrap gap-2">
              <SoundToggle muted={sound.muted} onToggle={sound.toggleMute} />
              <button
                onClick={() => setShowHistory(true)}
                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Game History
              </button>
              <button
                onClick={() => setShowPGN(true)}
                className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                PGN
              </button>
            </div>
          </>
        )}

        {/* Game History Panel */}
        {showHistory && !replay.isActive && (
          <GameHistoryPanel
            onReplay={handleStartReplay}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Captured Pieces */}
        {!replay.isActive && <CapturedPieces captured={getCapturedPieces()} />}

        {/* Move History */}
        <MoveHistory
          history={replay.isActive ? replay.moves : moveHistory}
          currentMoveIndex={replay.isActive ? replay.currentIndex : undefined}
          onMoveClick={replay.isActive ? replay.goToMove : undefined}
        />
      </div>

      {/* PGN Modal */}
      {showPGN && (
        <PGNModal
          history={moveHistory}
          result={getGameResult()}
          onImport={handlePGNImport}
          onClose={() => setShowPGN(false)}
        />
      )}
    </div>
  );
}
