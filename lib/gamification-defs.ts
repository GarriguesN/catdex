/**
 * Pure logic for Fase B (rangos / rareza / cosméticos) — no PocketBase
 * dependency, safe to unit test directly. UI wiring lives in
 * app/profile/page.tsx and app/cat/page.tsx.
 */

export interface RankTier {
  key: string;
  name: string;
  minScore: number;
}

// Ascending by minScore — rankForScore relies on this order.
export const RANK_TIERS: RankTier[] = [
  { key: "novice", name: "Novato", minScore: 0 },
  { key: "hunter", name: "Cazador", minScore: 100 },
  { key: "guardian", name: "Guardián de la Colonia", minScore: 500 },
  { key: "legend", name: "Leyenda Callejera", minScore: 2000 },
];

/** Highest tier whose threshold the score has reached. Never returns undefined —
 * negative/NaN scores fall back to the first (lowest) tier. */
export function rankForScore(score: number): RankTier {
  const safeScore = Number.isFinite(score) ? score : 0;
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (safeScore >= tier.minScore) current = tier;
  }
  return current;
}

export interface RarityInfo {
  key: "own" | "shared" | "legendary";
  label: string;
}

/** How many distinct users have photographed this cat → collaborative rarity. */
export function rarityForDiscovererCount(count: number): RarityInfo {
  if (count >= 3) return { key: "legendary", label: "Gato Legendario de la colonia" };
  if (count === 2) return { key: "shared", label: "Descubrimiento compartido" };
  return { key: "own", label: "Tuyo" };
}

// Matches lib/achievements-defs.ts's ACHIEVEMENT_DEFS[x].rarity values.
const RARITY_ORDER = ["Común", "Raro", "Épico", "Legendario"] as const;
export type AchievementRarity = (typeof RARITY_ORDER)[number];

/** Highest rarity among a set of unlocked badge codes, or null if none/unknown. */
export function highestRarity(
  badgeCodes: string[],
  defs: Record<string, { rarity: string }>
): AchievementRarity | null {
  let bestIndex = -1;
  let best: AchievementRarity | null = null;
  for (const code of badgeCodes) {
    const rarity = defs[code]?.rarity;
    const index = RARITY_ORDER.indexOf(rarity as AchievementRarity);
    if (index > bestIndex) {
      bestIndex = index;
      best = rarity as AchievementRarity;
    }
  }
  return best;
}

/** Avatar ring class per rarity tier — "" (no ring) for Común/unknown. */
export const RARITY_FRAME_CLASS: Record<string, string> = {
  Raro: "ring-2 ring-catdex-blue",
  Épico: "ring-2 ring-[#8B5CF6]",
  Legendario: "ring-[3px] ring-catdex-orange ring-offset-2 ring-offset-catdex-cream",
};
