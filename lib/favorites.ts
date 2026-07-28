/**
 * Client-side favorites — stored in localStorage, no backend schema changes.
 * Emits "catdex-favorites-change" so open views stay in sync.
 */

const KEY = "catdex_favorites";
const EVENT = "catdex-favorites-change";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function getFavorites(): Set<string> {
  return read();
}

export function isFavorite(catId: string): boolean {
  return read().has(catId);
}

export function toggleFavorite(catId: string): boolean {
  const favs = read();
  const nowFav = !favs.has(catId);
  if (nowFav) favs.add(catId);
  else favs.delete(catId);
  localStorage.setItem(KEY, JSON.stringify([...favs]));
  window.dispatchEvent(new Event(EVENT));
  return nowFav;
}

export function onFavoritesChange(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
