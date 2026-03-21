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
