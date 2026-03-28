"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { usePuzzle, PuzzleStatus } from "@/hooks/usePuzzle";
import { fetchPuzzleThemes } from "@/services/api";

// Format theme names: "backRankMate" → "Back Rank Mate"
function formatTheme(theme: string): string {
  return theme
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

interface PuzzlePanelProps {
  puzzle: ReturnType<typeof usePuzzle>;
}

/**
 * Left panel for puzzle mode — shows status, puzzle info, actions, and filters.
 * The board itself is rendered by ChessGame using puzzle.fen and puzzle handlers.
 */
export default function PuzzlePanel({ puzzle }: PuzzlePanelProps) {
  const { theme } = useTheme();

  const [themes, setThemes] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [ratingMin, setRatingMin] = useState(800);
  const [ratingMax, setRatingMax] = useState(2000);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load themes on mount
  useEffect(() => {
    fetchPuzzleThemes().then(setThemes);
  }, []);

  // Load first puzzle on mount
  useEffect(() => {
    if (!hasLoaded) {
      puzzle.loadPuzzle(ratingMin, ratingMax, selectedTheme || undefined);
      setHasLoaded(true);
    }
  }, [hasLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextPuzzle = useCallback(() => {
    puzzle.loadPuzzle(ratingMin, ratingMax, selectedTheme || undefined);
  }, [puzzle.loadPuzzle, ratingMin, ratingMax, selectedTheme]);

  // Determine board side for display text
  const boardSide = puzzle.fen.includes(" w ") ? "white" : "black";

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
    <div className="flex flex-col gap-3">
      {/* Stats header */}
      <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-1`}>
          Puzzles
        </h3>
        <p className={`text-sm ${theme.textPrimary}`}>
          Solved: {puzzle.stats.solved} / {puzzle.stats.attempted} attempted
          {puzzle.stats.streak > 0 && ` | Streak: ${puzzle.stats.streak}`}
        </p>
      </div>

      {/* Status bar */}
      <div className={`text-center py-2 px-3 rounded-lg ${
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
  );
}
