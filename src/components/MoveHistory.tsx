"use client";

import { useRef, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { CLASSIFICATION_STYLES } from "@/hooks/useGameReview";
import type { MoveAnalysis } from "@/services/api";

interface MoveHistoryProps {
  history: string[];
  currentMoveIndex?: number; // for replay mode highlighting
  onMoveClick?: (index: number) => void; // for replay/navigation
  reviewAnalysis?: MoveAnalysis[]; // optional review data for color-coding moves
  /** Show a "Start" button at the beginning of the breadcrumb trail */
  showStart?: boolean;
  onStartClick?: () => void;
  /** Label above the panel */
  label?: string;
}

export default function MoveHistory({
  history,
  currentMoveIndex,
  onMoveClick,
  reviewAnalysis,
  showStart = false,
  onStartClick,
  label = "Move History",
}: MoveHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Auto-scroll to highlighted move during replay, or to bottom during play
  useEffect(() => {
    if (!containerRef.current) return;
    if (currentMoveIndex !== undefined && currentMoveIndex >= 0) {
      const moveEl = containerRef.current.querySelector(`[data-move-index="${currentMoveIndex}"]`);
      if (moveEl) {
        moveEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    } else if (currentMoveIndex === undefined) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history.length, currentMoveIndex]);

  const isClickable = !!onMoveClick;

  // Get review color for a move
  const getMoveColor = (moveIndex: number): string | undefined => {
    if (reviewAnalysis && moveIndex < reviewAnalysis.length) {
      const cls = reviewAnalysis[moveIndex].classification;
      const style = CLASSIFICATION_STYLES[cls];
      if (style) return style.color;
    }
    return undefined;
  };

  // Get classification symbol suffix
  const getSymbol = (moveIndex: number): string => {
    if (!reviewAnalysis || moveIndex >= reviewAnalysis.length) return "";
    const cls = reviewAnalysis[moveIndex].classification;
    const style = CLASSIFICATION_STYLES[cls];
    return style?.symbol || "";
  };

  // Get tooltip for a move
  const getTitle = (moveIndex: number): string | undefined => {
    if (!reviewAnalysis || moveIndex >= reviewAnalysis.length) return undefined;
    const a = reviewAnalysis[moveIndex];
    const style = CLASSIFICATION_STYLES[a.classification];
    return `${style?.label} (${a.score_loss > 0 ? `-${a.score_loss} cp` : "best"})`;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
        {label}
      </h3>
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto ${theme.panel} rounded-lg p-3 min-h-[120px] max-h-[300px]`}
      >
        {history.length === 0 && !showStart ? (
          <p className={`${theme.textMuted} text-sm italic`}>No moves yet</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
            {/* Optional Start button */}
            {showStart && (
              <button
                onClick={onStartClick}
                className={`px-1.5 py-0.5 rounded ${
                  history.length === 0 && currentMoveIndex === undefined
                    ? "bg-blue-600 text-white"
                    : `${theme.textMuted} hover:bg-white/10`
                } transition-colors`}
              >
                Start
              </button>
            )}

            {history.map((move, i) => {
              const isWhite = i % 2 === 0;
              const moveNum = Math.floor(i / 2) + 1;
              const isHighlighted = currentMoveIndex !== undefined && i === currentMoveIndex;
              const isLatest = currentMoveIndex === undefined && i === history.length - 1;
              const moveColor = getMoveColor(i);

              return (
                <span key={i} className="flex items-center gap-0.5">
                  {/* Move number */}
                  {isWhite && (
                    <span className={`${theme.textMuted} mr-0.5`}>{moveNum}.</span>
                  )}
                  {/* Black move after separator in explorer breadcrumb style */}
                  {!isWhite && showStart && (
                    <span className={theme.textMuted}>&rsaquo;</span>
                  )}
                  <button
                    data-move-index={i}
                    onClick={() => onMoveClick?.(i)}
                    title={getTitle(i)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      isHighlighted || isLatest
                        ? "bg-blue-600 text-white"
                        : isClickable
                        ? `${moveColor || theme.textSecondary} hover:bg-white/10 cursor-pointer`
                        : `${moveColor || theme.textSecondary}`
                    }`}
                    disabled={!isClickable}
                  >
                    {move}{getSymbol(i)}
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
