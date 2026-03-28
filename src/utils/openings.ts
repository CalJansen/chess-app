import openingsData from "@/data/openings.json";

export interface Opening {
  eco: string;
  name: string;
}

const openings = openingsData as Record<string, Opening>;

/**
 * Find the best matching opening for the given move history.
 * Tries the full history first, then progressively shorter prefixes.
 * Returns null if no opening matches (e.g., after theory ends).
 */
export function findOpening(history: string[]): Opening | null {
  // Try from longest to shortest prefix
  for (let len = history.length; len > 0; len--) {
    const key = history.slice(0, len).join(" ");
    if (openings[key]) {
      return openings[key];
    }
  }
  return null;
}
