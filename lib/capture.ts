import { db, type Cat } from "./db";
import { computePHash, similarity } from "./phash";
import { getImageData } from "./image";

export const HIGH_SUGGESTION = 85;
export const LOW_SUGGESTION = 60;

export interface MatchResult {
  status: "strong" | "weak" | "none";
  candidates: {
    catId: string;
    similarity: number;
    thumbBlobId: string;
  }[];
}

export async function computeHashFromCanvas(
  canvas: HTMLCanvasElement
): Promise<string> {
  const imageData = getImageData(canvas);
  return computePHash(imageData);
}

export async function suggestMatches(
  newHash: string
): Promise<MatchResult> {
  const allCats = await db.cats.toArray();

  const matches = allCats
    .map((cat) => ({ cat, sim: similarity(newHash, cat.hash) }))
    .filter((m) => m.sim >= LOW_SUGGESTION)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  if (matches.length === 0) return { status: "none", candidates: [] };

  const top = matches[0];
  const status = top.sim >= HIGH_SUGGESTION ? "strong" : "weak";

  return {
    status,
    candidates: matches.map((m) => ({
      catId: m.cat.id,
      similarity: m.sim,
      thumbBlobId: m.cat.thumbBlobId,
    })),
  };
}
