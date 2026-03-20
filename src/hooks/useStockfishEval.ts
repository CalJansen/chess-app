/**
 * Hook for Stockfish position evaluation.
 *
 * Debounces evaluation requests (300ms) so rapid position changes
 * (e.g., stepping through replay) don't flood the backend.
 * Aborts in-flight requests when a new one starts.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchEvaluation, checkStockfishAvailable, EvalResult } from "@/services/api";

interface UseStockfishEvalOptions {
  fen: string;
  enabled: boolean;
}

interface StockfishEvalState {
  score: number | null;       // Centipawns from White's perspective
  mateIn: number | null;      // Moves to forced mate
  bestMove: string | null;    // UCI string (e.g., "e2e4")
  pv: string[];               // Principal variation
  isLoading: boolean;
  isAvailable: boolean;       // False if Stockfish not installed
}

const DEBOUNCE_MS = 300;

export function useStockfishEval({ fen, enabled }: UseStockfishEvalOptions): StockfishEvalState {
  const [state, setState] = useState<StockfishEvalState>({
    score: null,
    mateIn: null,
    bestMove: null,
    pv: [],
    isLoading: false,
    isAvailable: false, // Assume unavailable until we check
  });

  // Refs for debounce timer and abort controller
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const availabilityChecked = useRef(false);

  // Check Stockfish availability on mount (eagerly, so the toggle shows correctly)
  useEffect(() => {
    if (availabilityChecked.current) return;

    let cancelled = false;
    checkStockfishAvailable().then((available) => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, isAvailable: available }));
        availabilityChecked.current = true;
      }
    });

    return () => { cancelled = true; };
  }, []);

  // Debounced evaluation
  const evaluate = useCallback(
    (fenToEval: string) => {
      // Cancel any in-flight request
      if (abortController.current) {
        abortController.current.abort();
      }

      const controller = new AbortController();
      abortController.current = controller;

      setState((prev) => ({ ...prev, isLoading: true }));

      fetchEvaluation(fenToEval, 18, controller.signal)
        .then((result: EvalResult | null) => {
          if (controller.signal.aborted) return;

          if (result === null) {
            // Stockfish unavailable
            setState((prev) => ({
              ...prev,
              isAvailable: false,
              isLoading: false,
            }));
            return;
          }

          setState((prev) => ({
            ...prev,
            score: result.score_cp,
            mateIn: result.mate_in,
            bestMove: result.best_move,
            pv: result.pv,
            isLoading: false,
          }));
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.error("Eval error:", err);
          setState((prev) => ({ ...prev, isLoading: false }));
        });
    },
    []
  );

  // Trigger evaluation when FEN changes (with debounce)
  useEffect(() => {
    if (!enabled || !state.isAvailable) {
      // Clear state when disabled
      if (!enabled) {
        setState((prev) => ({
          ...prev,
          score: null,
          mateIn: null,
          bestMove: null,
          pv: [],
          isLoading: false,
        }));
      }
      return;
    }

    // Clear previous debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the evaluation request
    debounceTimer.current = setTimeout(() => {
      evaluate(fen);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fen, enabled, state.isAvailable, evaluate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortController.current) abortController.current.abort();
    };
  }, []);

  return state;
}
