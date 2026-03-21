/**
 * API client for the chess backend.
 * All calls go through the Next.js proxy (/api/* -> localhost:8000/api/*).
 */

const API_BASE = "/api";

export interface AIMove {
  move: string;   // UCI (e.g., "e2e4")
  san: string;    // SAN (e.g., "e4")
  fen_after: string;
}

export interface EngineModel {
  name: string;
  description: string;
  type: string;
}

/**
 * Fetch the AI's chosen move for a given position.
 */
export async function fetchAIMove(
  fen: string,
  engine: string,
  timeLimitSeconds: number = 5
): Promise<AIMove> {
  const controller = new AbortController();
  // Client timeout = engine time limit + 5s buffer for network/overhead
  const clientTimeoutMs = timeLimitSeconds * 1000 + 5000;
  const timer = setTimeout(() => controller.abort(), clientTimeoutMs);

  try {
    const res = await fetch(`${API_BASE}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, engine, time_limit: timeLimitSeconds }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `API error: ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the list of available AI engines.
 */
export async function fetchAvailableModels(): Promise<EngineModel[]> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status}`);
  }
  return await res.json();
}

/**
 * Check if the backend is reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Stockfish Evaluation ─────────────────────────────────────────────────────

export interface EvalResult {
  score_cp: number;        // Centipawns from White's perspective
  mate_in: number | null;  // Moves to mate (null if none)
  best_move: string | null; // Best move in UCI (e.g., "e2e4")
  pv: string[];            // Principal variation
}

/**
 * Fetch Stockfish evaluation for a position.
 * Returns null if Stockfish is unavailable (503).
 */
export async function fetchEvaluation(
  fen: string,
  depth: number = 18,
  signal?: AbortSignal
): Promise<EvalResult | null> {
  try {
    const res = await fetch(`${API_BASE}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth }),
      signal,
    });

    if (res.status === 503) {
      // Stockfish not installed
      return null;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Eval error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return null; // Request was cancelled, not an error
    }
    throw err;
  }
}

/**
 * Check if Stockfish is available on the backend.
 */
export async function checkStockfishAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/evaluate/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.available === true;
  } catch {
    return false;
  }
}

// ─── Chess Puzzles ──────────────────────────────────────────────────────────

export interface PuzzleData {
  id: string;
  fen: string;
  moves: string[];     // UCI moves: first is setup, rest are solution
  rating: number;
  themes: string[];
  nb_plays: number;
  popularity: number;
}

/**
 * Fetch a random puzzle matching the given filters.
 */
export async function fetchRandomPuzzle(
  ratingMin: number = 0,
  ratingMax: number = 9999,
  theme?: string
): Promise<PuzzleData | null> {
  try {
    const params = new URLSearchParams();
    if (ratingMin > 0) params.set("rating_min", String(ratingMin));
    if (ratingMax < 9999) params.set("rating_max", String(ratingMax));
    if (theme) params.set("theme", theme);

    const res = await fetch(`${API_BASE}/puzzles/random?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 503) return null; // No puzzles loaded
    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch the list of available puzzle themes.
 */
export async function fetchPuzzleThemes(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/puzzles/themes`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ─── Game Review ──────────────────────────────────────────────────────────────

export interface MoveAnalysis {
  move: string;
  move_number: number;
  color: "white" | "black";
  classification: "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder" | "book" | "forced";
  score_before: number;
  score_after: number;
  score_loss: number;
  best_move: string | null;
  mate_before: number | null;
  mate_after: number | null;
}

export interface AccuracyStats {
  white: number;
  black: number;
}

export interface ReviewResult {
  analysis: MoveAnalysis[];
  accuracy: AccuracyStats;
}

/**
 * Request a full game review (Stockfish analysis of every move).
 * This can take 10-60 seconds depending on game length and depth.
 */
export async function fetchGameReview(
  moves: string[],
  depth: number = 16,
  signal?: AbortSignal
): Promise<ReviewResult | null> {
  try {
    const res = await fetch(`${API_BASE}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves, depth }),
      signal,
      // Long timeout — analysis takes time
    });

    if (res.status === 503) return null; // Stockfish not available
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Review error: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return null;
    }
    throw err;
  }
}
