"use client";

import { useRef, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { CLASSIFICATION_STYLES } from "@/hooks/useGameReview";
import type { MoveAnalysis } from "@/services/api";

interface MoveHistoryProps {
  history: string[];
  currentMoveIndex?: number; // for replay mode highlighting
  onMoveClick?: (index: number) => void; // for replay mode navigation
  reviewAnalysis?: MoveAnalysis[]; // optional review data for color-coding moves
}

export default function MoveHistory({
  history,
  currentMoveIndex,
  onMoveClick,
  reviewAnalysis,
}: MoveHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Auto-scroll to highlighted move during replay, or to bottom during play
  useEffect(() => {
    if (!containerRef.current) return;
    if (currentMoveIndex !== undefined && currentMoveIndex >= 0) {
      // Scroll to keep the current move visible
      const moveEl = containerRef.current.querySelector(`[data-move-index="${currentMoveIndex}"]`);
      if (moveEl) {
        moveEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    } else if (currentMoveIndex === undefined) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history.length, currentMoveIndex]);

  // Group moves into pairs (1. e4 e5, 2. Nf3 Nc6, ...)
  const pairs: { num: number; white: string; black?: string; whiteIndex: number; blackIndex: number }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
      whiteIndex: i,
      blackIndex: i + 1,
    });
  }

  const isClickable = !!onMoveClick;

  const moveClass = (moveIndex: number) => {
    const isHighlighted = currentMoveIndex !== undefined && moveIndex === currentMoveIndex;
    const clickable = isClickable ? "cursor-pointer hover:underline" : "";
    const highlight = isHighlighted ? "bg-blue-600/40 rounded px-1" : "";

    // Color-code based on review classification
    let classColor = theme.textSecondary;
    if (reviewAnalysis && moveIndex < reviewAnalysis.length) {
      const cls = reviewAnalysis[moveIndex].classification;
      const style = CLASSIFICATION_STYLES[cls];
      if (style) {
        classColor = style.color;
      }
    }

    return `${classColor} ${clickable} ${highlight}`;
  };

  // Get classification symbol suffix
  const getSymbol = (moveIndex: number): string => {
    if (!reviewAnalysis || moveIndex >= reviewAnalysis.length) return "";
    const cls = reviewAnalysis[moveIndex].classification;
    const style = CLASSIFICATION_STYLES[cls];
    return style?.symbol || "";
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
        Move History
      </h3>
      <div ref={containerRef} className={`flex-1 overflow-y-auto ${theme.panel} rounded-lg p-3 min-h-[120px] max-h-[300px]`}>
        {pairs.length === 0 ? (
          <p className={`${theme.textMuted} text-sm italic`}>No moves yet</p>
        ) : (
          <div className="space-y-1">
            {pairs.map((pair) => (
              <div key={pair.num} className="flex text-sm font-mono">
                <span className={`${theme.textMuted} w-8 shrink-0`}>{pair.num}.</span>
                <span
                  data-move-index={pair.whiteIndex}
                  className={`w-20 ${moveClass(pair.whiteIndex)}`}
                  onClick={() => onMoveClick?.(pair.whiteIndex)}
                  title={reviewAnalysis?.[pair.whiteIndex]
                    ? `${CLASSIFICATION_STYLES[reviewAnalysis[pair.whiteIndex].classification]?.label} (${reviewAnalysis[pair.whiteIndex].score_loss > 0 ? `-${reviewAnalysis[pair.whiteIndex].score_loss} cp` : "best"})`
                    : undefined}
                >
                  {pair.white}{getSymbol(pair.whiteIndex)}
                </span>
                {pair.black && (
                  <span
                    data-move-index={pair.blackIndex}
                    className={`${moveClass(pair.blackIndex)}`}
                    onClick={() => onMoveClick?.(pair.blackIndex)}
                    title={reviewAnalysis?.[pair.blackIndex]
                      ? `${CLASSIFICATION_STYLES[reviewAnalysis[pair.blackIndex].classification]?.label} (${reviewAnalysis[pair.blackIndex].score_loss > 0 ? `-${reviewAnalysis[pair.blackIndex].score_loss} cp` : "best"})`
                      : undefined}
                  >
                    {pair.black}{getSymbol(pair.blackIndex)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
