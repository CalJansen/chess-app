"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { getSavedGames, deleteGame, SavedGame } from "@/utils/gameHistory";

interface GameHistoryPanelProps {
  onReplay: (moves: string[], whitePlayer?: string, blackPlayer?: string) => void;
  onClose: () => void;
}

export default function GameHistoryPanel({ onReplay, onClose }: GameHistoryPanelProps) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide`}>
          Game History
        </h3>
        <button
          onClick={onClose}
          className={`px-3 py-1 text-xs ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg transition-colors`}
        >
          Close
        </button>
      </div>

      <div className={`${theme.panel} rounded-lg p-3 max-h-[400px] overflow-y-auto space-y-2`}>
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
