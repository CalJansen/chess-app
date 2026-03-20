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

  const btnClass = `flex-1 py-1.5 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded text-xs font-medium transition-colors`;
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
    <div className="flex gap-2 mt-1.5 w-full">
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
        <>
          <button
            onClick={handleNewGame}
            className="flex-1 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs font-medium transition-colors text-white"
          >
            Confirm
          </button>
          <button onClick={handleCancel} className={btnClass}>
            Cancel
          </button>
        </>
      ) : (
        <button onClick={handleNewGame} className={btnClass}>
          New Game
        </button>
      )}
    </div>
  );
}
