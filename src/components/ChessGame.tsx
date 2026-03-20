"use client";

import { useState, useEffect, useCallback } from "react";
import { useChessGame } from "@/hooks/useChessGame";
import { useAIGame } from "@/hooks/useAIGame";
import { useReplayMode } from "@/hooks/useReplayMode";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useChessClock } from "@/hooks/useChessClock";
import { useStockfishEval } from "@/hooks/useStockfishEval";
import { saveCompletedGame } from "@/utils/gameHistory";
import { findOpening } from "@/utils/openings";
import { fetchEvaluation } from "@/services/api";
import { getPlayerName, setPlayerName as persistPlayerName } from "@/utils/playerName";
import Board from "./Board";
import GameStatus from "./GameStatus";
import GameControls from "./GameControls";
import MoveHistory from "./MoveHistory";
import PlayerNameBar from "./PlayerNameBar";
import ThemeSelector from "./ThemeSelector";
import OpeningLabel from "./OpeningLabel";
import GameModeSelector from "./GameModeSelector";
import ReplayControls from "./ReplayControls";
import GameHistoryPanel from "./GameHistoryPanel";
import PGNModal from "./PGNModal";
import SoundToggle from "./SoundToggle";
import ChessClock from "./ChessClock";
import EvalBar from "./EvalBar";
import AnalysisToggle from "./AnalysisToggle";
import GameOverOverlay from "./GameOverOverlay";

export default function ChessGame() {
  // AI state needs to be declared before useChessGame so we can pass autoFlip option
  const [aiActive, setAiActive] = useState(false);

  const chessGame = useChessGame({ autoFlip: !aiActive });
  const replay = useReplayMode();
  const sound = useSoundEffects();
  const clock = useChessClock();

  const {
    fen,
    boardOrientation,
    squareStyles,
    moveHistory,
    turn,
    isGameOver,
    inCheck,
    currentOpening,
    lastMoveType,
    initialized,
    getStatus,
    getGameResult,
    getCapturedPieces,
    onSquareClick,
    onPieceDrop,
    onPieceDragBegin,
    makeMoveFromSAN,
    undoMove,
    redoMove,
    canRedo,
    flipBoard,
    newGame,
  } = chessGame;

  const ai = useAIGame({
    fen,
    turn,
    isGameOver,
    moveHistory,
    makeMoveFromSAN,
  });

  // Keep aiActive in sync with the AI toggle
  useEffect(() => {
    setAiActive(ai.aiEnabled);
  }, [ai.aiEnabled]);

  const [showHistory, setShowHistory] = useState(false);
  const [showPGN, setShowPGN] = useState(false);
  const [gameEndSaved, setGameEndSaved] = useState(false);

  // Analysis state — persisted to localStorage
  const [analysisEnabled, setAnalysisEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("chess-analysis-enabled") === "true";
  });
  const [hintArrow, setHintArrow] = useState<{ from: string; to: string } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Player name state
  const [playerName, setPlayerNameState] = useState("Player 1");
  useEffect(() => {
    setPlayerNameState(getPlayerName());
  }, []);
  const handlePlayerNameChange = useCallback((name: string) => {
    setPlayerNameState(name);
    persistPlayerName(name);
  }, []);

  // Persist analysis preference
  useEffect(() => {
    localStorage.setItem("chess-analysis-enabled", String(analysisEnabled));
  }, [analysisEnabled]);

  // Clear hint arrow when a new move is made
  useEffect(() => {
    setHintArrow(null);
  }, [moveHistory.length]);

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
      clock.startClock();
    }
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
        whitePlayer: ai.aiEnabled && ai.playerColor === "black" ? ai.selectedEngine : playerName,
        blackPlayer: ai.aiEnabled && ai.playerColor === "white" ? ai.selectedEngine : (ai.aiEnabled ? playerName : "Player 2"),
      });
      setGameEndSaved(true);
    }
  }, [isGameOver, gameEndSaved, moveHistory, currentOpening, getGameResult, ai.aiEnabled, ai.playerColor]);

  // Check for timeout
  const timeoutMessage = clock.whiteTimedOut
    ? "White ran out of time! Black wins!"
    : clock.blackTimedOut
    ? "Black ran out of time! White wins!"
    : null;

  // In AI mode, undo 2 moves (AI + human) so it's the player's turn again
  const handleUndo = useCallback(() => {
    undoMove();
    if (ai.aiEnabled) {
      undoMove();
    }
  }, [undoMove, ai.aiEnabled]);

  const handleRedo = useCallback(() => {
    redoMove();
    if (ai.aiEnabled) {
      redoMove();
    }
  }, [redoMove, ai.aiEnabled]);

  const handleNewGame = useCallback(() => {
    newGame();
    clock.resetClock();
    setGameEndSaved(false);
    setHintArrow(null);
  }, [newGame, clock]);

  const handleHint = useCallback(async () => {
    if (hintLoading || isGameOver) return;
    setHintLoading(true);
    try {
      const result = await fetchEvaluation(fen, 16);
      if (result?.best_move) {
        setHintArrow({
          from: result.best_move.slice(0, 2),
          to: result.best_move.slice(2, 4),
        });
      }
    } catch {
      // Stockfish unavailable
    } finally {
      setHintLoading(false);
    }
  }, [fen, hintLoading, isGameOver]);

  const handleStartReplay = useCallback(
    (moves: string[], whitePlayer?: string, blackPlayer?: string) => {
      replay.startReplay(moves, whitePlayer, blackPlayer);
      setShowHistory(false);
    },
    [replay]
  );

  const handlePGNImport = useCallback(
    (moves: string[]) => {
      replay.startReplay(moves);
      setShowPGN(false);
    },
    [replay]
  );

  // Review handler for game-over overlay — must be above early return (Rules of Hooks)
  const handleReview = useCallback(() => {
    if (moveHistory.length > 0) {
      replay.startReplay(moveHistory);
    }
  }, [moveHistory, replay]);

  // Determine display state (must be above early return so hooks are consistent)
  const displayFen = replay.isActive ? replay.displayFen : fen;
  const displayOrientation = replay.isActive
    ? "white"
    : ai.aiEnabled
    ? ai.playerColor
    : boardOrientation;

  // Stockfish evaluation — must be called before any early returns (Rules of Hooks)
  const evaluation = useStockfishEval({ fen: displayFen, enabled: analysisEnabled });

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="opacity-40">Loading...</p>
      </div>
    );
  }

  // In AI mode, lock the board during AI's turn
  const isAITurn = ai.aiEnabled && turn !== ai.playerColor;
  const boardDisabled = replay.isActive || isAITurn || ai.aiThinking;

  const replayOpening = replay.isActive
    ? findOpening(replay.moves.slice(0, replay.currentIndex + 1))
    : null;

  // Build hint arrow (one-shot from Hint button)
  const bestMoveArrows = hintArrow
    ? [
        {
          startSquare: hintArrow.from,
          endSquare: hintArrow.to,
          color: "rgba(0, 180, 80, 0.7)",
        },
      ]
    : [];

  // Derive player names for the board name bars
  const captured = getCapturedPieces();
  const bottomColor = displayOrientation;
  const topColor = displayOrientation === "white" ? "black" : "white";

  const getNameForColor = (color: "white" | "black"): string => {
    if (replay.isActive) {
      return color === "white" ? (replay.whitePlayer || "White") : (replay.blackPlayer || "Black");
    }
    if (ai.aiEnabled) {
      return color === ai.playerColor ? playerName : ai.selectedEngine;
    }
    return color === "white" ? playerName : "Player 2";
  };

  const isEditable = (color: "white" | "black"): boolean => {
    if (replay.isActive) return false;
    if (ai.aiEnabled) return color === ai.playerColor;
    return color === "white"; // Only white player name is editable in PvP
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-5xl mx-auto min-h-screen items-center lg:items-start justify-center">
      {/* Board area: eval bar + player names + board */}
      <div className="flex-shrink-0 flex flex-row items-stretch">
        {analysisEnabled && (
          <EvalBar
            scoreCp={evaluation.score}
            mateIn={evaluation.mateIn}
            isLoading={evaluation.isLoading}
            boardOrientation={displayOrientation}
          />
        )}
        <div className="relative">
          <PlayerNameBar
            name={getNameForColor(topColor)}
            color={topColor}
            isActive={turn === topColor}
            capturedPieces={topColor === "white" ? captured.white : captured.black}
            position="top"
            isEditable={isEditable(topColor)}
            onNameChange={handlePlayerNameChange}
          />
          <Board
            fen={displayFen}
            boardOrientation={displayOrientation}
            squareStyles={boardDisabled ? {} : squareStyles}
            arrows={bestMoveArrows}
            onSquareClick={boardDisabled ? () => {} : onSquareClick}
            onPieceDrop={boardDisabled ? () => false : onPieceDrop}
            onPieceDragBegin={boardDisabled ? () => {} : onPieceDragBegin}
          />
          <PlayerNameBar
            name={getNameForColor(bottomColor)}
            color={bottomColor}
            isActive={turn === bottomColor}
            capturedPieces={bottomColor === "white" ? captured.white : captured.black}
            position="bottom"
            isEditable={isEditable(bottomColor)}
            onNameChange={handlePlayerNameChange}
          />

          {/* Game over overlay on the board */}
          {(isGameOver || !!timeoutMessage) && !replay.isActive && (
            <GameOverOverlay
              status={timeoutMessage || getStatus()}
              onNewGame={handleNewGame}
              onReview={moveHistory.length > 0 ? handleReview : undefined}
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-72 flex flex-col gap-4">
        <ThemeSelector />

        {/* AI Mode Selector */}
        {!replay.isActive && (
          <GameModeSelector
            aiEnabled={ai.aiEnabled}
            aiThinking={ai.aiThinking}
            selectedEngine={ai.selectedEngine}
            playerColor={ai.playerColor}
            availableModels={ai.availableModels}
            backendOnline={ai.backendOnline}
            error={ai.error}
            onToggleAI={ai.toggleAI}
            onSetEngine={ai.setEngine}
            onSetColor={ai.setColor}
          />
        )}

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
            inCheck={inCheck}
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
              onUndo={handleUndo}
              onRedo={handleRedo}
              onFlip={flipBoard}
              onNewGame={handleNewGame}
              canUndo={moveHistory.length >= (ai.aiEnabled ? 2 : 1) && !ai.aiThinking}
              canRedo={canRedo && !ai.aiThinking}
            />
            <AnalysisToggle
              analysisEnabled={analysisEnabled}
              onToggleAnalysis={() => setAnalysisEnabled((prev) => !prev)}
              onHint={handleHint}
              hintLoading={hintLoading}
              isAvailable={evaluation.isAvailable}
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
