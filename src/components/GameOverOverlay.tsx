"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface GameOverOverlayProps {
  status: string;
  onNewGame: () => void;
  onReview?: () => void;
}

export default function GameOverOverlay({
  status,
  onNewGame,
  onReview,
}: GameOverOverlayProps) {
  const { theme } = useTheme();

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg" />

      {/* Card */}
      <div
        className={`relative ${theme.panel} rounded-xl p-6 shadow-2xl border ${theme.panelBorder} text-center animate-[scaleIn_0.3s_ease-out]`}
        style={{ minWidth: "200px" }}
      >
        <p className={`text-lg font-bold ${theme.textPrimary} mb-4`}>
          {status}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onNewGame}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            New Game
          </button>
          {onReview && (
            <button
              onClick={onReview}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
