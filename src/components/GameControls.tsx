"use client";

import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface GameControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onFlip: () => void;
  onNewGame: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function GameControls({
  onUndo,
  onRedo,
  onFlip,
  onNewGame,
  canUndo,
  canRedo,
}: GameControlsProps) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const { theme } = useTheme();

  const btnClass = `px-4 py-2 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg text-sm font-medium transition-colors`;
  const disabledClass = "disabled:opacity-40 disabled:cursor-not-allowed";

  const handleNewGame = () => {
    if (confirmingNewGame) {
      onNewGame();
      setConfirmingNewGame(false);
    } else {
      setConfirmingNewGame(true);
    }
  };

  const handleCancel = () => {
    setConfirmingNewGame(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`${btnClass} ${disabledClass}`}
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`${btnClass} ${disabledClass}`}
      >
        Redo
      </button>
      <button onClick={onFlip} className={btnClass}>
        Flip Board
      </button>
      {confirmingNewGame ? (
        <div className="flex gap-2">
          <button
            onClick={handleNewGame}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors text-white"
          >
            Confirm Reset
          </button>
          <button onClick={handleCancel} className={btnClass}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={handleNewGame} className={btnClass}>
          New Game
        </button>
      )}
    </div>
  );
}
