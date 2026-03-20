export interface SavedGame {
  id: string;
  date: string;
  moves: string[];
  result: string;
  opening: string;
  whitePlayer: string;
  blackPlayer: string;
}

const STORAGE_KEY = "chess-app-game-history";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getSavedGames(): SavedGame[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCompletedGame(game: Omit<SavedGame, "id" | "date">): SavedGame {
  const saved: SavedGame = {
    ...game,
    id: generateId(),
    date: new Date().toISOString(),
  };
  const games = getSavedGames();
  games.unshift(saved); // newest first
  // Keep max 50 games
  if (games.length > 50) games.length = 50;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    // localStorage full or unavailable
  }
  return saved;
}

export function deleteGame(id: string): void {
  const games = getSavedGames().filter((g) => g.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    // ignore
  }
}

export function clearAllGames(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
