/**
 * Lichess Opening Explorer API client.
 *
 * Proxies requests through our backend which handles authentication.
 * Results are cached in memory to avoid redundant calls as users
 * navigate back and forth through openings.
 */

const EXPLORER_API_URL = "http://localhost:8000/api/explorer";

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;   // win count for white
  draws: number;   // draw count
  black: number;   // win count for black
  averageRating: number;
}

export interface ExplorerData {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening: { eco: string; name: string } | null;
}

// In-memory cache: FEN -> ExplorerData
const cache = new Map<string, ExplorerData>();

// Debounce: track the latest request to avoid stale results
let latestRequestId = 0;

/**
 * Fetch opening explorer stats from Lichess for a given FEN.
 * Results are cached. Returns null on error or if superseded by a newer request.
 */
export async function fetchExplorerStats(
  fen: string,
  speeds: string[] = ["blitz", "rapid", "classical"],
  ratings: number[] = [1600, 1800, 2000, 2200, 2500],
): Promise<ExplorerData | null> {
  // Check cache first
  const cacheKey = fen;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const requestId = ++latestRequestId;

  try {
    const params = new URLSearchParams({
      fen,
      speeds: speeds.join(","),
      ratings: ratings.join(","),
    });

    const res = await fetch(`${EXPLORER_API_URL}?${params}`);

    // If a newer request was started, discard this result
    if (requestId !== latestRequestId) return null;

    if (!res.ok) return null;

    const data = await res.json();

    const result: ExplorerData = {
      white: data.white ?? 0,
      draws: data.draws ?? 0,
      black: data.black ?? 0,
      moves: (data.moves ?? []).map((m: Record<string, unknown>) => ({
        uci: m.uci as string,
        san: m.san as string,
        white: (m.white as number) ?? 0,
        draws: (m.draws as number) ?? 0,
        black: (m.black as number) ?? 0,
        averageRating: (m.averageRating as number) ?? 0,
      })),
      opening: data.opening ?? null,
    };

    cache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Clear the explorer cache (useful for testing).
 */
export function clearExplorerCache() {
  cache.clear();
}
