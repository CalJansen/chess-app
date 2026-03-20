/**
 * Convert a move history array and result to PGN format.
 */
export function gameToPGN(
  history: string[],
  result: string = "*",
  metadata: Record<string, string> = {}
): string {
  const headers: Record<string, string> = {
    Event: "Chess App Game",
    Site: "Local",
    Date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    White: "Player 1",
    Black: "Player 2",
    Result: result,
    ...metadata,
  };

  const headerStr = Object.entries(headers)
    .map(([key, val]) => `[${key} "${val}"]`)
    .join("\n");

  // Build move text with numbering
  let moveText = "";
  for (let i = 0; i < history.length; i++) {
    if (i % 2 === 0) {
      moveText += `${Math.floor(i / 2) + 1}. `;
    }
    moveText += history[i] + " ";
  }
  moveText += result;

  return `${headerStr}\n\n${moveText.trim()}\n`;
}

/**
 * Parse a PGN string and extract the move list as SAN strings.
 */
export function pgnToMoves(pgn: string): string[] {
  // Remove headers (lines starting with [)
  const moveSection = pgn
    .split("\n")
    .filter((line) => !line.startsWith("[") && line.trim() !== "")
    .join(" ");

  // Remove comments {}, variations (), and result
  const cleaned = moveSection
    .replace(/\{[^}]*\}/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+\.\.\./g, "") // remove continuation dots
    .replace(/\d+\./g, "")     // remove move numbers
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, "") // remove result
    .trim();

  return cleaned
    .split(/\s+/)
    .filter((m) => m.length > 0 && !m.match(/^\d+$/));
}
