"use client";

/**
 * Analysis toggle controls — enable/disable Stockfish eval bar and best-move arrows.
 * Two independent toggles so the user can use either or both.
 */

import { useTheme } from "@/contexts/ThemeContext";

interface AnalysisToggleProps {
  analysisEnabled: boolean;
  showArrows: boolean;
  onToggleAnalysis: () => void;
  onToggleArrows: () => void;
  isAvailable: boolean;
}

export default function AnalysisToggle({
  analysisEnabled,
  showArrows,
  onToggleAnalysis,
  onToggleArrows,
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

      {/* Best Move Arrow toggle — only visible when eval is enabled */}
      {analysisEnabled && (
        <button
          onClick={onToggleArrows}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: showArrows ? "#2563eb" : theme.buttonBg,
            color: showArrows ? "#ffffff" : theme.buttonText,
          }}
          title="Toggle best move arrow on the board"
        >
          {showArrows ? "Arrow ON" : "Arrow OFF"}
        </button>
      )}
    </div>
  );
}
