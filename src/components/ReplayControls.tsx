"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface ReplayControlsProps {
  currentIndex: number;
  totalMoves: number;
  onStepBack: () => void;
  onStepForward: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
  onGoToMove: (index: number) => void;
  onExit: () => void;
}

export default function ReplayControls({
  currentIndex,
  totalMoves,
  onStepBack,
  onStepForward,
  onGoToStart,
  onGoToEnd,
  onGoToMove,
  onExit,
}: ReplayControlsProps) {
  const { theme } = useTheme();
  const btnClass = `px-3 py-2 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg text-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide`}>
          Replay Mode
        </h3>
        <button
          onClick={onExit}
          className={`px-3 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors`}
        >
          Exit Replay
        </button>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={onGoToStart}
          disabled={currentIndex <= -1}
          className={btnClass}
          title="Go to start"
        >
          &#x23EE;
        </button>
        <button
          onClick={onStepBack}
          disabled={currentIndex <= -1}
          className={btnClass}
          title="Step back"
        >
          &#x23F4;
        </button>
        <button
          onClick={onStepForward}
          disabled={currentIndex >= totalMoves - 1}
          className={btnClass}
          title="Step forward"
        >
          &#x23F5;
        </button>
        <button
          onClick={onGoToEnd}
          disabled={currentIndex >= totalMoves - 1}
          className={btnClass}
          title="Go to end"
        >
          &#x23ED;
        </button>
      </div>

      {/* Scrubber slider */}
      <div className="flex items-center gap-2">
        <span className={`text-xs ${theme.textMuted} w-8 text-right`}>
          {currentIndex + 1}
        </span>
        <input
          type="range"
          min={-1}
          max={totalMoves - 1}
          value={currentIndex}
          onChange={(e) => onGoToMove(parseInt(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <span className={`text-xs ${theme.textMuted} w-8`}>
          {totalMoves}
        </span>
      </div>
    </div>
  );
}
