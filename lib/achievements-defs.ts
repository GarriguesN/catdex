// Achievement definitions for display — no DB dependency (safe for client components)
// `icon` is a lucide-react icon name, resolved via ACHIEVEMENT_ICONS in
// components/AchievementBadge.tsx.

export const ACHIEVEMENT_DEFS: Record<
  string,
  { name: string; icon: string; rarity: string }
> = {
  first_catch: { name: "Primer gato", icon: "Cat", rarity: "Común" },
  collector_10: { name: "Coleccionista", icon: "Layers", rarity: "Común" },
  collector_25: { name: "Maestro Gatuno", icon: "Crown", rarity: "Raro" },
  photographer_50: { name: "Paparazzi", icon: "Camera", rarity: "Común" },
  photographer_500: { name: "Fotógrafo profesional", icon: "Aperture", rarity: "Épico" },
  lucky_day: { name: "Día de suerte", icon: "Dice5", rarity: "Raro" },
  night_owl: { name: "Vigía nocturno", icon: "Moon", rarity: "Común" },
  early_bird: { name: "Madrugador", icon: "Sunrise", rarity: "Común" },
  explorer_3: { name: "Explorador", icon: "Map", rarity: "Común" },
  explorer_10: { name: "Cartógrafo", icon: "Compass", rarity: "Raro" },
  loyal_5: { name: "Mejor amigo", icon: "Heart", rarity: "Común" },
  loyal_50: { name: "Obsesionado", icon: "Repeat", rarity: "Raro" },
  rainy_day: { name: "Día de lluvia", icon: "CloudRain", rarity: "Épico" },
  streak_7: { name: "Racha semanal", icon: "Flame", rarity: "Raro" },
  streak_30: { name: "Racha mensual", icon: "Trophy", rarity: "Legendario" },
  namer: { name: "Bautista", icon: "PenLine", rarity: "Común" },
  notekeeper: { name: "Anotador", icon: "NotebookPen", rarity: "Común" },
  share_first: { name: "Embajador", icon: "Globe", rarity: "Común" },
};
