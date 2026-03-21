const STORAGE_KEY = "chess-app-player-name";

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Player 1";
  try {
    return localStorage.getItem(STORAGE_KEY) || "Player 1";
  } catch {
    return "Player 1";
  }
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, name.trim() || "Player 1");
  } catch {
    // localStorage not available
  }
}
