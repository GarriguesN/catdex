import { db, type Achievement } from "./db";

interface AchievementCheck {
  id: string;
  condition: () => Promise<boolean>;
}

export async function checkAchievements(): Promise<Achievement[]> {
  const newOnes: Achievement[] = [];

  const cats = await db.cats.toArray();
  const photos = await db.photos.toArray();
  const alreadyUnlocked = new Set(
    (await db.achievements.toArray()).map((a) => a.id)
  );

  const checks: AchievementCheck[] = [
    { id: "first_catch", condition: async () => cats.length >= 1 },
    { id: "collector_10", condition: async () => cats.length >= 10 },
    { id: "collector_25", condition: async () => cats.length >= 25 },
    { id: "photographer_50", condition: async () => photos.length >= 50 },
    { id: "photographer_500", condition: async () => photos.length >= 500 },
    {
      id: "night_owl",
      condition: async () =>
        photos.some((p) => {
          const h = new Date(p.takenAt).getHours();
          return h >= 22 || h < 6;
        }),
    },
    {
      id: "early_bird",
      condition: async () =>
        photos.some((p) => {
          const h = new Date(p.takenAt).getHours();
          return h >= 5 && h < 8;
        }),
    },
    {
      id: "lucky_day",
      condition: async () => {
        const byDay = new Map<string, number>();
        for (const c of cats) {
          const day = new Date(c.createdAt).toDateString();
          byDay.set(day, (byDay.get(day) || 0) + 1);
        }
        return [...byDay.values()].some((v) => v >= 3);
      },
    },
    {
      id: "explorer_3",
      condition: async () => {
        const locs = getDistinctLocations(photos, 500);
        return locs >= 3;
      },
    },
    {
      id: "explorer_10",
      condition: async () => {
        const locs = getDistinctLocations(photos, 500);
        return locs >= 10;
      },
    },
    {
      id: "loyal_5",
      condition: async () =>
        cats.some((c) => c.photoCount >= 5),
    },
    {
      id: "loyal_50",
      condition: async () =>
        cats.some((c) => c.photoCount >= 50),
    },
    {
      id: "rainy_day",
      condition: async () =>
        cats.some(
          (c) =>
            c.notes && /lluvia|lloviendo|rain/i.test(c.notes)
        ),
    },
    {
      id: "streak_7",
      condition: async () => hasStreak(7, photos),
    },
    {
      id: "streak_30",
      condition: async () => hasStreak(30, photos),
    },
    {
      id: "namer",
      condition: async () =>
        cats.filter((c) => c.manuallyNamed).length >= 5,
    },
    {
      id: "notekeeper",
      condition: async () =>
        cats.filter((c) => c.notes && c.notes.length > 0).length >= 10,
    },
    {
      id: "share_first",
      condition: async () => {
        try {
          const s = await db.settings.get("hasShared");
          return !!s?.value;
        } catch {
          return false;
        }
      },
    },
  ];

  for (const check of checks) {
    if (!alreadyUnlocked.has(check.id) && (await check.condition())) {
      const achievement: Achievement = {
        id: check.id,
        unlockedAt: Date.now(),
        seen: false,
      };
      newOnes.push(achievement);
    }
  }

  if (newOnes.length > 0) {
    await db.achievements.bulkAdd(newOnes);
  }
  return newOnes;
}

function getDistinctLocations(
  photos: { lat?: number; lng?: number }[],
  minDistanceM: number
): number {
  const withLoc = photos.filter(
    (p) => p.lat !== undefined && p.lng !== undefined
  ) as { lat: number; lng: number }[];
  const clusters: { lat: number; lng: number }[] = [];

  for (const p of withLoc) {
    const isNear = clusters.some(
      (c) => haversineDistance(c.lat, c.lng, p.lat, p.lng) < minDistanceM
    );
    if (!isNear) clusters.push({ lat: p.lat, lng: p.lng });
  }

  return clusters.length;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function hasStreak(days: number, photos: { takenAt: number }[]): boolean {
  if (photos.length === 0) return false;
  const daysSet = new Set(
    photos.map((p) => {
      const d = new Date(p.takenAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const sorted = [...daysSet]
    .map((s) => new Date(s).getTime())
    .sort((a, b) => b - a);

  let streak = 1;
  const DAY_MS = 86400000;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] <= DAY_MS + 1000) {
      streak++;
      if (streak >= days) return true;
    } else {
      streak = 1;
    }
  }
  return streak >= days;
}

// Achievement definitions for display
export const ACHIEVEMENT_DEFS: Record<
  string,
  { name: string; emoji: string; rarity: string }
> = {
  first_catch: { name: "Primer gato", emoji: "🐱", rarity: "Común" },
  collector_10: { name: "Coleccionista", emoji: "🔟", rarity: "Común" },
  collector_25: { name: "Maestro Gatuno", emoji: "👑", rarity: "Raro" },
  photographer_50: { name: "Paparazzi", emoji: "📸", rarity: "Común" },
  photographer_500: { name: "Fotógrafo profesional", emoji: "📷", rarity: "Épico" },
  lucky_day: { name: "Día de suerte", emoji: "🎲", rarity: "Raro" },
  night_owl: { name: "Vigía nocturno", emoji: "🌙", rarity: "Común" },
  early_bird: { name: "Madrugador", emoji: "🌅", rarity: "Común" },
  explorer_3: { name: "Explorador", emoji: "🗺️", rarity: "Común" },
  explorer_10: { name: "Cartógrafo", emoji: "🧭", rarity: "Raro" },
  loyal_5: { name: "Mejor amigo", emoji: "💕", rarity: "Común" },
  loyal_50: { name: "Obsesionado", emoji: "🔄", rarity: "Raro" },
  rainy_day: { name: "Día de lluvia", emoji: "🌧️", rarity: "Épico" },
  streak_7: { name: "Racha semanal", emoji: "🔥", rarity: "Raro" },
  streak_30: { name: "Racha mensual", emoji: "🏆", rarity: "Legendario" },
  namer: { name: "Bautista", emoji: "✍️", rarity: "Común" },
  notekeeper: { name: "Anotador", emoji: "📝", rarity: "Común" },
  share_first: { name: "Embajador", emoji: "🌍", rarity: "Común" },
};
