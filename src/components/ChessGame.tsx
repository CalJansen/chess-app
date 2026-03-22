"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useChessGame } from "@/hooks/useChessGame";
import { useAIGame } from "@/hooks/useAIGame";
import { useReplayMode } from "@/hooks/useReplayMode";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useChessClock } from "@/hooks/useChessClock";
import { useStockfishEval } from "@/hooks/useStockfishEval";
import { useGameReview } from "@/hooks/useGameReview";
import { usePuzzle } from "@/hooks/usePuzzle";
import { useOpeningExplorer } from "@/hooks/useOpeningExplorer";
import { useAppMode } from "@/contexts/AppModeContext";
import { saveCompletedGame } from "@/utils/gameHistory";
import { findOpening } from "@/utils/openings";
import { fetchEvaluation } from "@/services/api";
import { getPlayerName, setPlayerName as persistPlayerName } from "@/utils/playerName";
import Board from "./Board";
import PlayerNameBar from "./PlayerNameBar";
import GameControls from "./GameControls";
import ReplayControls from "./ReplayControls";
import EvalBar from "./EvalBar";
import GameOverOverlay from "./GameOverOverlay";
import TabBar from "./TabBar";
import PlayPanel from "./panels/PlayPanel";
import PlaySidebar from "./panels/PlaySidebar";
import PuzzlePanel from "./panels/PuzzlePanel";
import HistoryPanel from "./panels/HistoryPanel";
import ExplorerPanel from "./panels/ExplorerPanel";

export default function ChessGame() {
  const { mode, setMode } = useAppMode();

  // ── All hooks must be called unconditionally (Rules of Hooks) ──

  const [aiActive, setAiActive] = useState(false);
  const chessGame = useChessGame({ autoFlip: !aiActive });
  const replay = useReplayMode();
  const sound = useSoundEffects();
  const clock = useChessClock();
  const review = useGameReview();
  const puzzle = usePuzzle();
  const explorer = useOpeningExplorer();

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

  useEffect(() => {
    setAiActive(ai.aiEnabled);
  }, [ai.aiEnabled]);

  const [gameEndSaved, setGameEndSaved] = useState(false);

  // Analysis state
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

  // Clear hint arrow on new moves
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

  const timeoutMessage = clock.whiteTimedOut
    ? "White ran out of time! Black wins!"
    : clock.blackTimedOut
    ? "Black ran out of time! White wins!"
    : null;

  // AI-mode double undo/redo
  const handleUndo = useCallback(() => {
    undoMove();
    if (ai.aiEnabled) undoMove();
  }, [undoMove, ai.aiEnabled]);

  const handleRedo = useCallback(() => {
    redoMove();
    if (ai.aiEnabled) redoMove();
  }, [redoMove, ai.aiEnabled]);

  const handleNewGame = useCallback(() => {
    newGame();
    clock.resetClock();
    setGameEndSaved(false);
    setHintArrow(null);
    review.clearReview();
  }, [newGame, clock, review]);

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
    },
    [replay]
  );

  const handlePGNImport = useCallback(
    (moves: string[]) => {
      replay.startReplay(moves);
    },
    [replay]
  );

  const handleStartFromOpening = useCallback(() => {
    const moves = explorer.getStartingMoves();
    newGame(moves);
    clock.resetClock();
    setGameEndSaved(false);
    setHintArrow(null);
    review.clearReview();
    setMode("play");
  }, [explorer, newGame, clock, review, setMode]);

  const handleReview = useCallback(() => {
    if (moveHistory.length > 0) {
      replay.startReplay(moveHistory,
        ai.aiEnabled && ai.playerColor === "black" ? ai.selectedEngine : playerName,
        ai.aiEnabled && ai.playerColor === "white" ? ai.selectedEngine : (ai.aiEnabled ? playerName : "Player 2"),
      );
      review.startReview(moveHistory);
    }
  }, [moveHistory, replay, review, ai.aiEnabled, ai.playerColor, ai.selectedEngine, playerName]);

  // ── Puzzle board config ──
  const [puzzleBoardSide, setPuzzleBoardSide] = useState<"white" | "black">("white");
  useEffect(() => {
    if (puzzle.status === "playing" && puzzle.puzzle) {
      setPuzzleBoardSide(puzzle.fen.includes(" w ") ? "white" : "black");
    }
  }, [puzzle.puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build puzzle square styles
  const puzzleSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (mode !== "puzzles") return styles;

    // Last move highlight
    if (puzzle.lastMove) {
      styles[puzzle.lastMove.from] = { backgroundColor: "rgba(255, 255, 0, 0.2)" };
      styles[puzzle.lastMove.to] = { backgroundColor: "rgba(255, 255, 0, 0.2)" };
    }

    // Check highlight
    if (puzzle.inCheck) {
      const fenParts = puzzle.fen.split(" ");
      const turnColor = fenParts[1] === "w" ? "K" : "k";
      const rows = fenParts[0].split("/");
      for (let r = 0; r < 8; r++) {
        let col = 0;
        for (const ch of rows[r]) {
          if (ch >= "1" && ch <= "8") {
            col += parseInt(ch);
          } else {
            if (ch === turnColor) {
              const file = String.fromCharCode(97 + col);
              const rank = 8 - r;
              styles[`${file}${rank}`] = {
                background: "radial-gradient(circle, rgba(255, 0, 0, 0.6) 0%, rgba(255, 0, 0, 0.3) 50%, rgba(255, 0, 0, 0) 70%)",
              };
            }
            col++;
          }
        }
      }
    }

    // Selected square
    if (puzzle.selectedSquare) {
      styles[puzzle.selectedSquare] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
    }

    // Legal move dots
    for (const sq of puzzle.legalMoves) {
      const fenParts = puzzle.fen.split(" ")[0].split("/");
      const file = sq.charCodeAt(0) - 97;
      const rank = 8 - parseInt(sq[1]);
      let col = 0;
      let hasPiece = false;
      for (const ch of fenParts[rank]) {
        if (ch >= "1" && ch <= "8") {
          col += parseInt(ch);
        } else {
          if (col === file) hasPiece = true;
          col++;
        }
      }
      if (hasPiece) {
        styles[sq] = {
          background: "radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.3) 55%)",
        };
      } else {
        styles[sq] = {
          background: "radial-gradient(circle, rgba(0, 0, 0, 0.25) 25%, transparent 25%)",
        };
      }
    }

    return styles;
  }, [mode, puzzle.lastMove, puzzle.inCheck, puzzle.fen, puzzle.selectedSquare, puzzle.legalMoves]);

  // Puzzle board handlers
  const handlePuzzleSquareClick = useCallback(
    (square: string) => {
      if (puzzle.status !== "playing" && puzzle.status !== "wrong") return;
      if (puzzle.selectedSquare && puzzle.selectedSquare !== square && puzzle.legalMoves.includes(square)) {
        puzzle.tryMove(puzzle.selectedSquare, square);
        return;
      }
      puzzle.selectSquare(square);
    },
    [puzzle]
  );

  const handlePuzzlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (puzzle.status !== "playing" && puzzle.status !== "wrong") return false;
      return puzzle.tryMove(sourceSquare, targetSquare);
    },
    [puzzle]
  );

  // ── Compute display state based on active mode ──

  const isPlayMode = mode === "play";
  const isPuzzleMode = mode === "puzzles";
  const isExplorerMode = mode === "explorer";
  const isHistoryMode = mode === "history";

  // Play mode display
  const playDisplayFen = replay.isActive ? replay.displayFen : fen;
  const playDisplayOrientation = replay.isActive
    ? "white"
    : ai.aiEnabled
    ? ai.playerColor
    : boardOrientation;

  // Board config based on mode
  const displayFen = isPuzzleMode ? puzzle.fen
    : isExplorerMode ? explorer.currentFen
    : (isPlayMode || isHistoryMode) ? playDisplayFen
    : fen;

  const displayOrientation = isPuzzleMode ? puzzleBoardSide
    : (isPlayMode || isHistoryMode) ? playDisplayOrientation
    : "white" as const;

  // Board interaction
  const isAITurn = ai.aiEnabled && turn !== ai.playerColor;
  const playBoardDisabled = replay.isActive || isAITurn || ai.aiThinking;

  const boardSquareStyles = isPuzzleMode ? puzzleSquareStyles
    : isExplorerMode ? explorer.squareStyles
    : (isPlayMode && !playBoardDisabled) ? squareStyles
    : {};

  const boardOnSquareClick = isPuzzleMode ? handlePuzzleSquareClick
    : isExplorerMode ? explorer.onSquareClick
    : (isPlayMode && !playBoardDisabled) ? onSquareClick
    : () => {};

  const boardOnPieceDrop = isPuzzleMode ? handlePuzzlePieceDrop
    : isExplorerMode ? explorer.onPieceDrop
    : (isPlayMode && !playBoardDisabled) ? onPieceDrop
    : () => false;

  const boardOnPieceDragBegin = isPuzzleMode
    ? ((square: string) => { puzzle.selectSquare(square); })
    : isExplorerMode ? explorer.onPieceDragBegin
    : (isPlayMode && !playBoardDisabled) ? onPieceDragBegin
    : () => {};

  // Eval bar — show during analysis or game review
  const evalEnabled = (isPlayMode || isHistoryMode) && (analysisEnabled || (replay.isActive && review.status !== "idle"));
  const evaluation = useStockfishEval({ fen: displayFen, enabled: evalEnabled });

  // Hint arrow
  const bestMoveArrows = hintArrow && isPlayMode
    ? [{ startSquare: hintArrow.from, endSquare: hintArrow.to, color: "rgba(0, 180, 80, 0.7)" }]
    : [];

  // Player names
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
    return color === "white";
  };

  const replayOpening = replay.isActive
    ? findOpening(replay.moves.slice(0, replay.currentIndex + 1))
    : null;

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="opacity-40">Loading...</p>
      </div>
    );
  }

  // Show player name bars only in play mode (or during replay in play/history)
  const showPlayerNames = isPlayMode || (isHistoryMode && replay.isActive);
  // Show controls below the board
  const showPlayControls = isPlayMode && !replay.isActive;
  const showReplayControls = (isPlayMode || isHistoryMode) && replay.isActive;

  return (
    <div className="flex flex-col items-center p-4 max-w-6xl mx-auto min-h-screen">
      {/* Tab Bar */}
      <TabBar />

      {/* Main Content: 3-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-center lg:items-start justify-center">
        {/* Left Panel */}
        <div className="w-full lg:w-56 flex flex-col gap-3 order-2 lg:order-1">
          {isPlayMode && (
            <PlayPanel
              opening={replay.isActive ? replayOpening : currentOpening}
              moveHistory={moveHistory}
              isReplaying={replay.isActive}
              replayMoves={replay.moves}
              replayCurrentIndex={replay.currentIndex}
              onMoveClick={replay.isActive ? replay.goToMove : undefined}
              status={timeoutMessage || getStatus()}
              isGameOver={isGameOver || !!timeoutMessage}
              inCheck={inCheck}
              reviewStatus={review.status}
              reviewAnalysis={review.analysis}
              reviewAccuracy={review.accuracy}
              reviewError={review.error}
              reviewProgress={review.progress}
              onStartReview={() => review.startReview(replay.moves)}
            />
          )}

          {isPuzzleMode && (
            <PuzzlePanel puzzle={puzzle} />
          )}

          {isHistoryMode && (
            <HistoryPanel
              onReplay={handleStartReplay}
              isReplaying={replay.isActive}
              replayMoves={replay.moves}
              replayCurrentIndex={replay.currentIndex}
              onMoveClick={replay.isActive ? replay.goToMove : undefined}
              reviewStatus={review.status}
              reviewAnalysis={review.analysis}
              reviewAccuracy={review.accuracy}
              reviewError={review.error}
              reviewProgress={review.progress}
              onStartReview={() => review.startReview(replay.moves)}
            />
          )}

          {isExplorerMode && (
            <ExplorerPanel
              explorer={explorer}
              onStartFromHere={handleStartFromOpening}
            />
          )}
        </div>

        {/* Center: Board area */}
        <div className="flex-shrink-0 flex flex-row items-stretch order-1 lg:order-2">
          {evalEnabled && (
            <EvalBar
              scoreCp={evaluation.score}
              mateIn={evaluation.mateIn}
              isLoading={evaluation.isLoading}
              boardOrientation={displayOrientation}
            />
          )}
          <div className="relative">
            {showPlayerNames && (
              <PlayerNameBar
                name={getNameForColor(topColor)}
                color={topColor}
                isActive={turn === topColor}
                capturedPieces={topColor === "white" ? captured.white : captured.black}
                position="top"
                isEditable={isEditable(topColor)}
                onNameChange={handlePlayerNameChange}
              />
            )}
            <Board
              fen={displayFen}
              boardOrientation={displayOrientation}
              squareStyles={boardSquareStyles}
              arrows={bestMoveArrows}
              onSquareClick={boardOnSquareClick}
              onPieceDrop={boardOnPieceDrop}
              onPieceDragBegin={boardOnPieceDragBegin}
            />
            {showPlayerNames && (
              <PlayerNameBar
                name={getNameForColor(bottomColor)}
                color={bottomColor}
                isActive={turn === bottomColor}
                capturedPieces={bottomColor === "white" ? captured.white : captured.black}
                position="bottom"
                isEditable={isEditable(bottomColor)}
                onNameChange={handlePlayerNameChange}
              />
            )}

            {/* Controls below the board */}
            {showReplayControls && (
              <ReplayControls
                currentIndex={replay.currentIndex}
                totalMoves={replay.totalMoves}
                onStepBack={replay.stepBack}
                onStepForward={replay.stepForward}
                onGoToStart={replay.goToStart}
                onGoToEnd={replay.goToEnd}
                onGoToMove={replay.goToMove}
                onExit={() => { replay.stopReplay(); review.clearReview(); }}
              />
            )}

            {showPlayControls && (
              <GameControls
                onUndo={handleUndo}
                onRedo={handleRedo}
                onFlip={flipBoard}
                onNewGame={handleNewGame}
                canUndo={moveHistory.length >= (ai.aiEnabled ? 2 : 1) && !ai.aiThinking}
                canRedo={canRedo && !ai.aiThinking}
              />
            )}

            {/* Game over overlay */}
            {isPlayMode && (isGameOver || !!timeoutMessage) && !replay.isActive && (
              <GameOverOverlay
                status={timeoutMessage || getStatus()}
                onNewGame={handleNewGame}
                onReview={moveHistory.length > 0 ? handleReview : undefined}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-72 flex flex-col gap-3 order-3">
          {isPlayMode && (
            <PlaySidebar
              aiEnabled={ai.aiEnabled}
              aiThinking={ai.aiThinking}
              selectedEngine={ai.selectedEngine}
              playerColor={ai.playerColor}
              availableModels={ai.availableModels}
              backendOnline={ai.backendOnline}
              aiError={ai.error}
              onToggleAI={ai.toggleAI}
              onSetEngine={ai.setEngine}
              onSetColor={ai.setColor}
              whiteTime={clock.whiteTime}
              blackTime={clock.blackTime}
              activeColor={clock.activeColor}
              clockEnabled={clock.isEnabled}
              timeControl={clock.timeControl}
              onSetTimeControl={clock.setTimeControl}
              analysisEnabled={analysisEnabled}
              onToggleAnalysis={() => setAnalysisEnabled((prev) => !prev)}
              onHint={handleHint}
              hintLoading={hintLoading}
              stockfishAvailable={evaluation.isAvailable}
              muted={sound.muted}
              onToggleMute={sound.toggleMute}
              moveHistory={moveHistory}
              gameResult={getGameResult()}
              onPGNImport={handlePGNImport}
              isReplaying={replay.isActive}
            />
          )}
        </div>
      </div>
    </div>
  );
}
