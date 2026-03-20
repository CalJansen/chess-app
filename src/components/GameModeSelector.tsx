"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { EngineModel } from "@/services/api";

interface GameModeSelectorProps {
  aiEnabled: boolean;
  aiThinking: boolean;
  selectedEngine: string;
  playerColor: "white" | "black";
  availableModels: EngineModel[];
  backendOnline: boolean;
  error: string | null;
  onToggleAI: () => void;
  onSetEngine: (engine: string) => void;
  onSetColor: (color: "white" | "black") => void;
}

export default function GameModeSelector({
  aiEnabled,
  aiThinking,
  selectedEngine,
  playerColor,
  availableModels,
  backendOnline,
  error,
  onToggleAI,
  onSetEngine,
  onSetColor,
}: GameModeSelectorProps) {
  const { theme } = useTheme();

  return (
    <div className={`${theme.panel} rounded-lg p-3 space-y-2`}>
      {/* AI Toggle */}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${theme.textSecondary}`}>Play vs AI</span>
        <button
          onClick={onToggleAI}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            aiEnabled ? "bg-green-600" : `${theme.buttonBg}`
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              aiEnabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {aiEnabled && (
        <>
          {/* Backend status */}
          {!backendOnline && (
            <p className="text-xs text-yellow-400">
              Backend offline — start it with: <code className="bg-black/30 px-1 rounded">cd backend && venv/Scripts/uvicorn main:app --reload</code>
            </p>
          )}

          {/* Engine selector */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${theme.textMuted}`}>Engine:</span>
            <select
              value={selectedEngine}
              onChange={(e) => onSetEngine(e.target.value)}
              className={`flex-1 text-xs ${theme.panel} ${theme.textSecondary} rounded px-2 py-1 border ${theme.panelBorder}`}
            >
              {availableModels.length > 0 ? (
                availableModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} — {m.description.slice(0, 50)}
                  </option>
                ))
              ) : (
                <option value="random">random</option>
              )}
            </select>
          </div>

          {/* Play as */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${theme.textMuted}`}>Play as:</span>
            <button
              onClick={() => onSetColor("white")}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                playerColor === "white"
                  ? "bg-white text-black font-bold"
                  : `${theme.buttonBg} ${theme.buttonText}`
              }`}
            >
              White
            </button>
            <button
              onClick={() => onSetColor("black")}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                playerColor === "black"
                  ? "bg-gray-900 text-white font-bold border border-white"
                  : `${theme.buttonBg} ${theme.buttonText}`
              }`}
            >
              Black
            </button>
          </div>

          {/* Thinking indicator */}
          {aiThinking && (
            <p className={`text-xs ${theme.textMuted} animate-pulse`}>
              AI is thinking...
            </p>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
