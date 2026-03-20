"use client";

/**
 * Analysis controls — toggle Stockfish eval bar and request a one-shot hint.
 */

import { useTheme } from "@/contexts/ThemeContext";

interface AnalysisToggleProps {
  analysisEnabled: boolean;
  onToggleAnalysis: () => void;
  onHint: () => void;
  hintLoading: boolean;
  isAvailable: boolean;
}

export default function AnalysisToggle({
  analysisEnabled,
  onToggleAnalysis,
  onHint,
  hintLoading,
  isAvailable,
}: AnalysisToggleProps) {
  const { theme } = useTheme();

  if (!isAvailable) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs"
        style={{
          backgroundColor: theme.panel,
          border: `1px solid ${theme.panelBorder}`,
          color: theme.textMuted,
        }}
      >
        Stockfish not found -- install to enable analysis
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Eval Bar toggle */}
      <button
        onClick={onToggleAnalysis}
        className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          backgroundColor: analysisEnabled ? "#16a34a" : theme.buttonBg,
          color: analysisEnabled ? "#ffffff" : theme.buttonText,
        }}
        title="Toggle Stockfish evaluation bar"
      >
        {analysisEnabled ? "Eval ON" : "Eval OFF"}
      </button>

      {/* Hint button — one-shot, fetches best move */}
      <button
        onClick={onHint}
        disabled={hintLoading}
        className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        style={{
          backgroundColor: theme.buttonBg,
          color: theme.buttonText,
        }}
        title="Show the best move for the current position"
      >
        {hintLoading ? "Thinking..." : "Hint"}
      </button>
    </div>
  );
}
