"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { fetchAIMove, fetchAvailableModels, checkBackendHealth, EngineModel } from "@/services/api";

interface UseAIGameProps {
  fen: string;
  turn: string; // "white" | "black"
  isGameOver: boolean;
  moveHistory: string[];
  makeMoveFromSAN: (san: string) => boolean;
}

export function useAIGame({
  fen,
  turn,
  isGameOver,
  moveHistory,
  makeMoveFromSAN,
}: UseAIGameProps) {
  const [aiEnabled, setAIEnabled] = useState(false);
  const [aiThinking, setAIThinking] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState("random");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [availableModels, setAvailableModels] = useState<EngineModel[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent double-firing of AI moves
  const aiMoveInProgress = useRef(false);

  // Check backend health on mount and when AI is toggled on
  useEffect(() => {
    if (!aiEnabled) return;
    checkBackendHealth().then(setBackendOnline);
    fetchAvailableModels()
      .then(setAvailableModels)
      .catch(() => setAvailableModels([]));
  }, [aiEnabled]);

  // Trigger AI move when it's the AI's turn
  useEffect(() => {
    if (
      !aiEnabled ||
      !backendOnline ||
      isGameOver ||
      aiThinking ||
      aiMoveInProgress.current
    ) {
      return;
    }

    // It's the AI's turn if the current turn is NOT the player's color
    const isAITurn = turn !== playerColor;
    if (!isAITurn) return;

    aiMoveInProgress.current = true;
    setAIThinking(true);
    setError(null);

    fetchAIMove(fen, selectedEngine)
      .then((result) => {
        makeMoveFromSAN(result.san);
      })
      .catch((err) => {
        setError(err.message || "AI move failed");
      })
      .finally(() => {
        setAIThinking(false);
        aiMoveInProgress.current = false;
      });
  }, [
    aiEnabled,
    backendOnline,
    turn,
    playerColor,
    isGameOver,
    fen,
    selectedEngine,
    aiThinking,
    makeMoveFromSAN,
  ]);

  const toggleAI = useCallback(() => {
    setAIEnabled((prev) => !prev);
    setError(null);
  }, []);

  const setEngine = useCallback((engine: string) => {
    setSelectedEngine(engine);
  }, []);

  const setColor = useCallback((color: "white" | "black") => {
    setPlayerColor(color);
  }, []);

  // In AI mode, undo should undo 2 moves (the AI's response + the human's move)
  const aiUndoCount = aiEnabled ? 2 : 1;

  return {
    aiEnabled,
    aiThinking,
    selectedEngine,
    playerColor,
    availableModels,
    backendOnline,
    error,
    aiUndoCount,
    toggleAI,
    setEngine,
    setColor,
  };
}
