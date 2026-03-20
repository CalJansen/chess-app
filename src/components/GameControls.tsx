"use client";

import { useState } from "react";

interface GameControlsProps {
  onUndo: () => void;
  onFlip: () => void;
  onNewGame: () => void;
  canUndo: boolean;
}

export default function GameControls({
  onUndo,
  onFlip,
  onNewGame,
  canUndo,
}: GameControlsProps) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);

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
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
      >
        Undo Move
      </button>
      <button
        onClick={onFlip}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
      >
        Flip Board
      </button>
      {confirmingNewGame ? (
        <div className="flex gap-2">
          <button
            onClick={handleNewGame}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
          >
            Confirm Reset
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={handleNewGame}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          New Game
        </button>
      )}
    </div>
  );
}
