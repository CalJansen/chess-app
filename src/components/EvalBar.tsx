"use client";

/**
 * Vertical evaluation bar — shows Stockfish's assessment of the position.
 *
 * Visual design:
 *   - Thin vertical bar to the left of the chess board
 *   - White fill on top, black fill on bottom
 *   - Fill percentage uses a sigmoid curve so small advantages are visible
 *   - Score text overlay (e.g., "+1.5" or "M3")
 *   - Animated transitions for smooth updates
 *   - Flips when board orientation is "black"
 */

import { useTheme } from "@/contexts/ThemeContext";

interface EvalBarProps {
  scoreCp: number | null;
  mateIn: number | null;
  isLoading: boolean;
  boardOrientation: "white" | "black";
}

/**
 * Convert a centipawn score to a fill percentage (0-100).
 * Uses a sigmoid curve so:
 *   - 0 cp = 50% (even position)
 *   - +300 cp (~3 pawns) = ~73% (clear advantage, visually obvious)
 *   - +1000 cp = ~93% (winning, nearly full bar)
 *   - Mate = 100% / 0%
 */
function scoreToPercent(scoreCp: number, mateIn: number | null): number {
  if (mateIn !== null) {
    return mateIn > 0 ? 100 : 0;
  }
  // Sigmoid mapping: maps [-inf, +inf] to [2, 98]
  // The 0.004 factor controls steepness -- +250cp = ~63%, +500cp = ~81%
  const sigmoid = 2 / (1 + Math.exp(-0.004 * scoreCp)) - 1;
  return Math.max(2, Math.min(98, 50 + 48 * sigmoid));
}

/**
 * Format the score for display.
 * Examples: "+1.5", "-0.3", "M3", "-M5", "0.0"
 */
function formatScore(scoreCp: number, mateIn: number | null): string {
  if (mateIn !== null) {
    return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`;
  }
  const pawns = scoreCp / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

export default function EvalBar({
  scoreCp,
  mateIn,
  isLoading,
  boardOrientation,
}: EvalBarProps) {
  const { theme } = useTheme();

  // Default to 50% (even) when no score available
  const whitePercent =
    scoreCp !== null
      ? scoreToPercent(scoreCp, mateIn)
      : 50;

  // When board is flipped (black's perspective), invert the bar
  // so black's advantage appears on top
  const topPercent =
    boardOrientation === "white" ? whitePercent : 100 - whitePercent;
  const bottomPercent = 100 - topPercent;

  const scoreText =
    scoreCp !== null ? formatScore(scoreCp, mateIn) : "";

  // Determine if White or Black is better for text positioning
  const whiteIsBetter = scoreCp !== null && scoreCp >= 0;
  const showScoreOnTop =
    boardOrientation === "white" ? whiteIsBetter : !whiteIsBetter;

  return (
    <div
      className="relative flex flex-col rounded-l-lg overflow-hidden"
      style={{
        width: "28px",
        border: `1px solid ${theme.panelBorder}`,
        borderRight: "none",
      }}
    >
      {/* Top section (white when board=white, black when board=black) */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          height: `${topPercent}%`,
          backgroundColor:
            boardOrientation === "white" ? "#f0f0f0" : "#333333",
        }}
      />

      {/* Bottom section */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          height: `${bottomPercent}%`,
          backgroundColor:
            boardOrientation === "white" ? "#333333" : "#f0f0f0",
        }}
      />

      {/* Score text overlay */}
      {scoreText && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{
            // Position the score in the smaller section for contrast
            ...(showScoreOnTop
              ? { top: "4px" }
              : { bottom: "4px" }),
          }}
        >
          <span
            className="text-[10px] font-bold leading-none"
            style={{
              color: showScoreOnTop
                ? (boardOrientation === "white" ? "#333" : "#f0f0f0")
                : (boardOrientation === "white" ? "#f0f0f0" : "#333"),
            }}
          >
            {scoreText}
          </span>
        </div>
      )}

      {/* Loading pulse overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-blue-400 opacity-20 animate-pulse" />
      )}
    </div>
  );
}
