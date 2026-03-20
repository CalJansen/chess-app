"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { formatTime, TimeControl, TIME_CONTROLS } from "@/hooks/useChessClock";

interface ChessClockProps {
  whiteTime: number;
  blackTime: number;
  activeColor: "white" | "black" | null;
  isEnabled: boolean;
  timeControl: TimeControl;
  onSetTimeControl: (tc: TimeControl) => void;
}

export default function ChessClock({
  whiteTime,
  blackTime,
  activeColor,
  isEnabled,
  timeControl,
  onSetTimeControl,
}: ChessClockProps) {
  const { theme } = useTheme();

  const clockClass = (color: "white" | "black") => {
    const isActive = activeColor === color;
    const time = color === "white" ? whiteTime : blackTime;
    const isLow = time < 30000 && time > 0; // less than 30s

    return `px-4 py-2 rounded-lg font-mono text-lg font-bold transition-colors ${
      isActive
        ? isLow
          ? "bg-red-700 text-white"
          : "bg-green-700 text-white"
        : `${theme.panel} ${theme.textSecondary}`
    }`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs ${theme.textMuted}`}>Timer:</span>
        <select
          value={timeControl.name}
          onChange={(e) => {
            const tc = TIME_CONTROLS.find((t) => t.name === e.target.value);
            if (tc) onSetTimeControl(tc);
          }}
          className={`text-xs ${theme.panel} ${theme.textSecondary} rounded px-2 py-1 border ${theme.panelBorder}`}
        >
          {TIME_CONTROLS.map((tc) => (
            <option key={tc.name} value={tc.name}>
              {tc.name}
            </option>
          ))}
        </select>
      </div>

      {isEnabled && (
        <div className="flex gap-3 justify-center">
          <div className="text-center">
            <div className={`text-xs ${theme.textMuted} mb-1`}>White</div>
            <div className={clockClass("white")}>{formatTime(whiteTime)}</div>
          </div>
          <div className="text-center">
            <div className={`text-xs ${theme.textMuted} mb-1`}>Black</div>
            <div className={clockClass("black")}>{formatTime(blackTime)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
