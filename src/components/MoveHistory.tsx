"use client";

import { useRef, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface MoveHistoryProps {
  history: string[];
  currentMoveIndex?: number; // for replay mode highlighting
  onMoveClick?: (index: number) => void; // for replay mode navigation
}

export default function MoveHistory({
  history,
  currentMoveIndex,
  onMoveClick,
}: MoveHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (currentMoveIndex === undefined && containerRef.current) {
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
    return `${theme.textSecondary} ${clickable} ${highlight}`;
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
                  className={`w-16 ${moveClass(pair.whiteIndex)}`}
                  onClick={() => onMoveClick?.(pair.whiteIndex)}
                >
                  {pair.white}
                </span>
                {pair.black && (
                  <span
                    className={`${moveClass(pair.blackIndex)} opacity-80`}
                    onClick={() => onMoveClick?.(pair.blackIndex)}
                  >
                    {pair.black}
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
