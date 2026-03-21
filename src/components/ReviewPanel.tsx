"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { CLASSIFICATION_STYLES, type ReviewStatus } from "@/hooks/useGameReview";
import type { MoveAnalysis, AccuracyStats } from "@/services/api";

interface ReviewPanelProps {
  status: ReviewStatus;
  analysis: MoveAnalysis[];
  accuracy: AccuracyStats | null;
  error: string | null;
  progress: string;
  currentMoveIndex: number;
  onStartReview: () => void;
}

// Count classifications for a given color
function countByClass(analysis: MoveAnalysis[], color: string) {
  const counts: Record<string, number> = {};
  for (const a of analysis) {
    if (a.color === color) {
      counts[a.classification] = (counts[a.classification] || 0) + 1;
    }
  }
  return counts;
}

// Accuracy bar component
function AccuracyBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { theme } = useTheme();
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-medium ${theme.textSecondary}`}>{label}</span>
        <span className={`text-sm font-bold ${color}`}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${value}%`,
            backgroundColor: value >= 80 ? "#22c55e" : value >= 60 ? "#eab308" : value >= 40 ? "#f97316" : "#ef4444",
          }}
        />
      </div>
    </div>
  );
}

// Classification count row
function ClassRow({ label, count, style }: { label: string; count: number; style: { color: string; symbol: string } }) {
  if (count === 0) return null;
  return (
    <div className="flex justify-between items-center">
      <span className={`text-xs ${style.color}`}>
        {style.symbol && <span className="font-bold mr-1">{style.symbol}</span>}
        {label}
      </span>
      <span className={`text-xs font-mono ${style.color}`}>{count}</span>
    </div>
  );
}

export default function ReviewPanel({
  status,
  analysis,
  accuracy,
  error,
  progress,
  currentMoveIndex,
  onStartReview,
}: ReviewPanelProps) {
  const { theme } = useTheme();

  // Current move info
  const currentAnalysis = currentMoveIndex >= 0 && currentMoveIndex < analysis.length
    ? analysis[currentMoveIndex]
    : null;

  if (status === "idle") {
    return (
      <div className={`${theme.panel} rounded-lg p-3 border border-white/10`}>
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
          Game Review
        </h3>
        <button
          onClick={onStartReview}
          className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Analyze Game
        </button>
        <p className={`text-xs ${theme.textMuted} mt-2`}>
          Stockfish evaluates every move and classifies accuracy.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className={`${theme.panel} rounded-lg p-3 border border-white/10`}>
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
          Game Review
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className={`text-sm ${theme.textSecondary}`}>{progress}</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`${theme.panel} rounded-lg p-3 border border-red-700`}>
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
          Game Review
        </h3>
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={onStartReview}
          className="mt-2 w-full py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Status === "done"
  const whiteCounts = countByClass(analysis, "white");
  const blackCounts = countByClass(analysis, "black");

  return (
    <div className={`${theme.panel} rounded-lg p-3 border border-white/10 space-y-3`}>
      <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide`}>
        Game Review
      </h3>

      {/* Accuracy bars */}
      {accuracy && (
        <div className="space-y-2">
          <AccuracyBar label="White" value={accuracy.white} color="text-white" />
          <AccuracyBar label="Black" value={accuracy.black} color="text-gray-300" />
        </div>
      )}

      {/* Classification breakdown */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div>
          <p className={`text-xs font-semibold ${theme.textMuted} mb-1`}>White</p>
          {(["best", "excellent", "good", "inaccuracy", "mistake", "blunder", "book", "forced"] as const).map((cls) => (
            <ClassRow
              key={cls}
              label={CLASSIFICATION_STYLES[cls].label}
              count={whiteCounts[cls] || 0}
              style={CLASSIFICATION_STYLES[cls]}
            />
          ))}
        </div>
        <div>
          <p className={`text-xs font-semibold ${theme.textMuted} mb-1`}>Black</p>
          {(["best", "excellent", "good", "inaccuracy", "mistake", "blunder", "book", "forced"] as const).map((cls) => (
            <ClassRow
              key={cls}
              label={CLASSIFICATION_STYLES[cls].label}
              count={blackCounts[cls] || 0}
              style={CLASSIFICATION_STYLES[cls]}
            />
          ))}
        </div>
      </div>

      {/* Current move detail */}
      {currentAnalysis && (
        <div className={`rounded-lg p-2 border border-white/10 ${CLASSIFICATION_STYLES[currentAnalysis.classification]?.bg || ""}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${CLASSIFICATION_STYLES[currentAnalysis.classification]?.color || theme.textPrimary}`}>
              {CLASSIFICATION_STYLES[currentAnalysis.classification]?.symbol}{" "}
              {currentAnalysis.move}
              {" — "}
              {CLASSIFICATION_STYLES[currentAnalysis.classification]?.label}
            </span>
            {currentAnalysis.score_loss > 0 && (
              <span className={`text-xs ${theme.textMuted}`}>
                -{currentAnalysis.score_loss} cp
              </span>
            )}
          </div>
          {currentAnalysis.best_move && (
            <p className={`text-xs ${theme.textMuted} mt-1`}>
              Best: <span className="text-green-400 font-mono">{currentAnalysis.best_move}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
