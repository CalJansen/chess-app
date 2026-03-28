"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { getSavedGames, deleteGame, SavedGame } from "@/utils/gameHistory";
import ReviewPanel from "@/components/ReviewPanel";
import type { MoveAnalysis, AccuracyStats } from "@/services/api";

interface HistoryPanelProps {
  onReplay: (moves: string[], whitePlayer?: string, blackPlayer?: string) => void;
  // Replay state
  isReplaying: boolean;
  replayMoves: string[];
  replayCurrentIndex: number;
  onMoveClick?: (index: number) => void;
  // Review
  reviewStatus: "idle" | "loading" | "done" | "error";
  reviewAnalysis: MoveAnalysis[] | null;
  reviewAccuracy: AccuracyStats | null;
  reviewError: string | null;
  reviewProgress: string;
  onStartReview: () => void;
}

export default function HistoryPanel({
  onReplay,
  isReplaying,
  replayMoves,
  replayCurrentIndex,
  onMoveClick,
  reviewStatus,
  reviewAnalysis,
  reviewAccuracy,
  reviewError,
  reviewProgress,
  onStartReview,
}: HistoryPanelProps) {
  const { theme } = useTheme();
  const [games, setGames] = useState<SavedGame[]>([]);

  useEffect(() => {
    setGames(getSavedGames());
  }, []);

  const handleDelete = (id: string) => {
    deleteGame(id);
    setGames(getSavedGames());
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // When replaying, show the review panel instead of the game list
  if (isReplaying) {
    return (
      <div className="flex flex-col gap-3">
        {/* Move list during replay */}
        <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
          <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
            Replay
          </h3>
          <div className="max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-sm">
              {replayMoves.map((move, i) => {
                const isWhite = i % 2 === 0;
                const moveNum = Math.floor(i / 2) + 1;
                const isActive = i === replayCurrentIndex;
                return (
                  <button
                    key={i}
                    onClick={() => onMoveClick?.(i)}
                    className={`text-left px-1 py-0.5 rounded text-xs ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : `${theme.textSecondary} hover:bg-white/10`
                    }`}
                  >
                    {isWhite && <span className={`${theme.textMuted} mr-1`}>{moveNum}.</span>}
                    {move}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Review panel */}
        <ReviewPanel
          status={reviewStatus}
          analysis={reviewAnalysis ?? []}
          accuracy={reviewAccuracy}
          error={reviewError}
          progress={reviewProgress}
          currentMoveIndex={replayCurrentIndex}
          onStartReview={onStartReview}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
          Game History
        </h3>
      </div>

      <div className={`${theme.panel} rounded-lg p-3 max-h-[500px] overflow-y-auto space-y-2`}>
        {games.length === 0 ? (
          <p className={`${theme.textMuted} text-sm italic`}>No saved games yet</p>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className={`${theme.statusDefault} border ${theme.panelBorder} rounded-lg p-3 space-y-1`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${theme.textMuted}`}>{formatDate(game.date)}</span>
                <span className={`text-xs font-bold ${theme.textSecondary}`}>{game.result}</span>
              </div>
              <p className={`text-xs font-medium ${theme.textPrimary}`}>
                {game.whitePlayer || "Player 1"} vs {game.blackPlayer || "Player 2"}
              </p>
              {game.opening && (
                <p className={`text-xs ${theme.textSecondary}`}>{game.opening}</p>
              )}
              <p className={`text-xs ${theme.textMuted}`}>{game.moves.length} moves</p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => onReplay(game.moves, game.whitePlayer, game.blackPlayer)}
                  className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  Replay
                </button>
                <button
                  onClick={() => handleDelete(game.id)}
                  className="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
