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
  timeoutMs: number = 10000
): Promise<AIMove> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, engine }),
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
