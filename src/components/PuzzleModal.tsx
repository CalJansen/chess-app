"use client";

import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";
import { usePuzzle } from "@/hooks/usePuzzle";
import { fetchPuzzleThemes } from "@/services/api";

interface PuzzleModalProps {
  onClose: () => void;
}

// Format theme names: "backRankMate" → "Back Rank Mate"
function formatTheme(theme: string): string {
  return theme
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function PuzzleModal({ onClose }: PuzzleModalProps) {
  const { theme } = useTheme();
  const puzzle = usePuzzle();

  const [themes, setThemes] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [ratingMin, setRatingMin] = useState(800);
  const [ratingMax, setRatingMax] = useState(2000);

  // Load themes on mount
  useEffect(() => {
    fetchPuzzleThemes().then(setThemes);
  }, []);

  // Load first puzzle on mount
  useEffect(() => {
    puzzle.loadPuzzle(ratingMin, ratingMax, selectedTheme || undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextPuzzle = useCallback(() => {
    puzzle.loadPuzzle(ratingMin, ratingMax, selectedTheme || undefined);
  }, [puzzle.loadPuzzle, ratingMin, ratingMax, selectedTheme]);

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      return puzzle.tryMove(sourceSquare, targetSquare);
    },
    [puzzle.tryMove]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (puzzle.status !== "playing" && puzzle.status !== "wrong") return;

      // If a piece is already selected and this square is a legal move, try it
      if (puzzle.selectedSquare && puzzle.selectedSquare !== square && puzzle.legalMoves.includes(square)) {
        puzzle.tryMove(puzzle.selectedSquare, square);
        return;
      }

      // Otherwise select/deselect this square
      puzzle.selectSquare(square);
    },
    [puzzle]
  );

  // Lock board orientation to the player's color (determined when puzzle loads, not on every FEN change)
  const [boardSide, setBoardSide] = useState<"white" | "black">("white");
  useEffect(() => {
    if (puzzle.status === "playing" && puzzle.puzzle) {
      // After the setup move, it's the player's turn — lock orientation to that color
      setBoardSide(puzzle.fen.includes(" w ") ? "white" : "black");
    }
  }, [puzzle.puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build square styles for highlighting
  const squareStyles: Record<string, React.CSSProperties> = {};

  // Last move highlight
  if (puzzle.lastMove) {
    squareStyles[puzzle.lastMove.from] = { backgroundColor: "rgba(255, 255, 0, 0.2)" };
    squareStyles[puzzle.lastMove.to] = { backgroundColor: "rgba(255, 255, 0, 0.2)" };
  }

  // Check highlight
  if (puzzle.inCheck) {
    // Find the king square
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
            squareStyles[`${file}${rank}`] = {
              background: "radial-gradient(circle, rgba(255, 0, 0, 0.6) 0%, rgba(255, 0, 0, 0.3) 50%, rgba(255, 0, 0, 0) 70%)",
            };
          }
          col++;
        }
      }
    }
  }

  // Selected square highlight
  if (puzzle.selectedSquare) {
    squareStyles[puzzle.selectedSquare] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
  }

  // Legal move dots
  for (const sq of puzzle.legalMoves) {
    // Check if square has a piece (capture dot vs empty dot)
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
      squareStyles[sq] = {
        background: "radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.3) 55%)",
      };
    } else {
      squareStyles[sq] = {
        background: "radial-gradient(circle, rgba(0, 0, 0, 0.25) 25%, transparent 25%)",
      };
    }
  }

  // Status message and colors
  let statusMessage = "";
  let statusColor = "";
  if (puzzle.status === "loading") {
    statusMessage = "Loading puzzle...";
    statusColor = theme.textMuted;
  } else if (puzzle.status === "playing") {
    statusMessage = `Find the best move for ${boardSide}`;
    statusColor = theme.textSecondary;
  } else if (puzzle.status === "wrong") {
    statusMessage = puzzle.showingSolution
      ? `Solution: ${puzzle.solutionMoves.join(", ")}`
      : "Not quite — try again!";
    statusColor = "text-red-400";
  } else if (puzzle.status === "correct") {
    statusMessage = "Correct! Keep going...";
    statusColor = "text-green-400";
  } else if (puzzle.status === "solved") {
    statusMessage = "Puzzle solved!";
    statusColor = "text-green-400";
  } else if (puzzle.status === "no-puzzles") {
    statusMessage = "No puzzles available. Run: python -m training.download_puzzles";
    statusColor = "text-yellow-400";
  }

  // Progress indicator
  const progressText = puzzle.totalSolutionMoves > 0
    ? `Move ${Math.min(puzzle.solutionIndex + 1, puzzle.totalSolutionMoves)}/${puzzle.totalSolutionMoves}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`${theme.panel} rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[95vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className={`text-xl font-bold ${theme.textPrimary}`}>Chess Puzzles</h2>
            <p className={`text-sm ${theme.textMuted}`}>
              Solved: {puzzle.stats.solved} / {puzzle.stats.attempted} attempted
              {puzzle.stats.streak > 0 && ` | Streak: ${puzzle.stats.streak}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText}`}
          >
            Close
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 p-6">
          {/* Board */}
          <div className="flex-shrink-0">
            <div className="w-[400px] aspect-square">
              <Chessboard
                options={{
                  position: puzzle.fen,
                  boardOrientation: boardSide,
                  squareStyles,
                  onSquareClick: ({ square }) => {
                    handleSquareClick(square);
                  },
                  onPieceDrag: ({ square }) => {
                    if (square) puzzle.selectSquare(square);
                  },
                  onPieceDrop: ({ sourceSquare, targetSquare }) => {
                    if (!targetSquare) return false;
                    if (puzzle.status !== "playing" && puzzle.status !== "wrong") return false;
                    return handlePieceDrop(sourceSquare, targetSquare);
                  },
                  darkSquareStyle: { backgroundColor: theme.darkSquare },
                  lightSquareStyle: { backgroundColor: theme.lightSquare },
                  animationDurationInMs: 200,
                }}
              />
            </div>

            {/* Status bar below board */}
            <div className={`mt-3 text-center py-2 px-3 rounded-lg ${
              puzzle.status === "solved"
                ? "bg-green-900/40 border border-green-700"
                : puzzle.status === "wrong"
                ? "bg-red-900/40 border border-red-700"
                : puzzle.lastMoveCorrect === true
                ? "bg-green-900/30 border border-green-800"
                : `${theme.panel} border border-white/10`
            }`}>
              <p className={`text-sm font-semibold ${statusColor}`}>{statusMessage}</p>
              {progressText && (
                <p className={`text-xs ${theme.textMuted} mt-1`}>{progressText}</p>
              )}
            </div>
          </div>

          {/* Sidebar controls */}
          <div className="flex-1 flex flex-col gap-4 min-w-[200px]">
            {/* Puzzle info */}
            {puzzle.puzzle && (
              <div className={`${theme.panel} rounded-lg p-3 border border-white/10`}>
                <p className={`text-sm font-semibold ${theme.textPrimary}`}>
                  Rating: {puzzle.puzzle.rating}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {puzzle.puzzle.themes.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-800"
                    >
                      {formatTheme(t)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {(puzzle.status === "solved" || puzzle.status === "wrong") && (
                <button
                  onClick={handleNextPuzzle}
                  className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Next Puzzle
                </button>
              )}
              {puzzle.status === "wrong" && !puzzle.showingSolution && (
                <button
                  onClick={puzzle.retry}
                  className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Retry
                </button>
              )}
              {(puzzle.status === "playing" || puzzle.status === "wrong") && !puzzle.showingSolution && (
                <button
                  onClick={puzzle.showSolution}
                  className={`w-full py-2 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg text-sm font-medium transition-colors`}
                >
                  Show Solution
                </button>
              )}
            </div>

            {/* Filters */}
            <div className={`${theme.panel} rounded-lg p-3 border border-white/10`}>
              <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-3`}>
                Filters
              </h3>

              {/* Rating range */}
              <div className="mb-3">
                <label className={`text-xs ${theme.textMuted} block mb-1`}>
                  Rating: {ratingMin} - {ratingMax}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={ratingMin}
                    onChange={(e) => setRatingMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-20 px-2 py-1 rounded text-sm ${theme.panel} ${theme.textPrimary} border border-white/20`}
                    min={0}
                    step={100}
                  />
                  <span className={`${theme.textMuted} self-center`}>-</span>
                  <input
                    type="number"
                    value={ratingMax}
                    onChange={(e) => setRatingMax(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-20 px-2 py-1 rounded text-sm ${theme.panel} ${theme.textPrimary} border border-white/20`}
                    min={0}
                    step={100}
                  />
                </div>
              </div>

              {/* Theme filter */}
              <div>
                <label className={`text-xs ${theme.textMuted} block mb-1`}>Theme</label>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className={`w-full px-2 py-1.5 rounded text-sm ${theme.panel} ${theme.textPrimary} border border-white/20`}
                >
                  <option value="">Any theme</option>
                  {themes.map((t) => (
                    <option key={t} value={t}>
                      {formatTheme(t)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Apply filters button */}
              <button
                onClick={handleNextPuzzle}
                className={`w-full mt-3 py-1.5 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded text-xs font-medium transition-colors`}
              >
                Load Puzzle with Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
