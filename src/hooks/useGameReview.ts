"use client";

import { useState, useCallback, useRef } from "react";
import { fetchGameReview, type MoveAnalysis, type AccuracyStats } from "@/services/api";

export type ReviewStatus = "idle" | "loading" | "done" | "error";

// Classification colors and symbols for UI display
export const CLASSIFICATION_STYLES: Record<string, { color: string; bg: string; symbol: string; label: string }> = {
  best:       { color: "text-green-400",  bg: "bg-green-900/40", symbol: "!!", label: "Best" },
  excellent:  { color: "text-green-300",  bg: "bg-green-900/30", symbol: "!",  label: "Excellent" },
  good:       { color: "text-blue-300",   bg: "bg-blue-900/30",  symbol: "",   label: "Good" },
  inaccuracy: { color: "text-yellow-400", bg: "bg-yellow-900/30", symbol: "?!", label: "Inaccuracy" },
  mistake:    { color: "text-orange-400", bg: "bg-orange-900/30", symbol: "?",  label: "Mistake" },
  blunder:    { color: "text-red-400",    bg: "bg-red-900/30",    symbol: "??", label: "Blunder" },
  book:       { color: "text-purple-300", bg: "bg-purple-900/30", symbol: "",   label: "Book" },
  forced:     { color: "text-gray-400",   bg: "bg-gray-900/30",   symbol: "",   label: "Forced" },
};

interface GameReviewState {
  status: ReviewStatus;
  analysis: MoveAnalysis[];
  accuracy: AccuracyStats | null;
  error: string | null;
  progress: string;
}

interface GameReviewActions {
  startReview: (moves: string[]) => void;
  clearReview: () => void;
  getClassification: (moveIndex: number) => MoveAnalysis | null;
}

export function useGameReview(): GameReviewState & GameReviewActions {
  const [status, setStatus] = useState<ReviewStatus>("idle");
  const [analysis, setAnalysis] = useState<MoveAnalysis[]>([]);
  const [accuracy, setAccuracy] = useState<AccuracyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const startReview = useCallback(async (moves: string[]) => {
    // Abort any in-flight review
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setAnalysis([]);
    setAccuracy(null);
    setError(null);
    setProgress(`Analyzing ${moves.length} moves...`);

    try {
      const result = await fetchGameReview(moves, 16, controller.signal);

      if (controller.signal.aborted) return;

      if (result === null) {
        setStatus("error");
        setError("Stockfish not available");
        return;
      }

      setAnalysis(result.analysis);
      setAccuracy(result.accuracy);
      setStatus("done");
      setProgress("");
    } catch (err) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Review failed");
      setProgress("");
    }
  }, []);

  const clearReview = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setAnalysis([]);
    setAccuracy(null);
    setError(null);
    setProgress("");
  }, []);

  const getClassification = useCallback(
    (moveIndex: number): MoveAnalysis | null => {
      if (moveIndex < 0 || moveIndex >= analysis.length) return null;
      return analysis[moveIndex];
    },
    [analysis]
  );

  return {
    status,
    analysis,
    accuracy,
    error,
    progress,
    startReview,
    clearReview,
    getClassification,
  };
}
