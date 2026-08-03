// Achievement definitions for display — no DB dependency (safe for client components)
// `icon` is a lucide-react icon name, resolved via ACHIEVEMENT_ICONS in
// components/AchievementBadge.tsx. `description` mirrors the server-side
// conditions in pb_hooks/achievements-utils.js.

export const ACHIEVEMENT_DEFS: Record<
  string,
  { name: string; icon: string; rarity: string; description: string }
> = {
  first_catch: { name: "Primer gato", icon: "Cat", rarity: "Común", description: "Captura tu primer gato" },
  collector_10: { name: "Coleccionista", icon: "Layers", rarity: "Común", description: "Descubre 10 gatos distintos" },
  collector_25: { name: "Maestro Gatuno", icon: "Crown", rarity: "Raro", description: "Descubre 25 gatos distintos" },
  photographer_50: { name: "Paparazzi", icon: "Camera", rarity: "Común", description: "Haz 50 fotos en total" },
  photographer_500: { name: "Fotógrafo profesional", icon: "Aperture", rarity: "Épico", description: "Haz 250 fotos en total" },
  lucky_day: { name: "Día de suerte", icon: "Dice5", rarity: "Raro", description: "Descubre 3 gatos en un mismo día" },
  night_owl: { name: "Vigía nocturno", icon: "Moon", rarity: "Común", description: "Captura un gato entre las 22:00 y las 5:00 (hora local)" },
  early_bird: { name: "Madrugador", icon: "Sunrise", rarity: "Común", description: "Captura un gato entre las 5:00 y las 8:00 (hora local)" },
  explorer_3: { name: "Explorador", icon: "Map", rarity: "Común", description: "Captura gatos en 3 zonas distintas" },
  explorer_10: { name: "Cartógrafo", icon: "Compass", rarity: "Raro", description: "Captura gatos en 10 zonas distintas" },
  loyal_5: { name: "Mejor amigo", icon: "Heart", rarity: "Común", description: "Haz 5 fotos a un mismo gato" },
  loyal_50: { name: "Obsesionado", icon: "Repeat", rarity: "Raro", description: "Haz 30 fotos a un mismo gato" },
  rainy_day: { name: "Día de lluvia", icon: "CloudRain", rarity: "Épico", description: "Captura un gato un día de lluvia" },
  snowy_day: { name: "Día de nieve", icon: "CloudSnow", rarity: "Raro", description: "Captura un gato mientras nieva" },
  heat_wave: { name: "Ola de calor", icon: "ThermometerSun", rarity: "Raro", description: "Captura un gato con 35 °C o más" },
  cold_snap: { name: "Frío polar", icon: "Snowflake", rarity: "Común", description: "Captura un gato con 0 °C o menos" },
  streak_7: { name: "Racha semanal", icon: "Flame", rarity: "Raro", description: "Captura 7 días seguidos" },
  streak_30: { name: "Racha mensual", icon: "Trophy", rarity: "Legendario", description: "Captura 30 días seguidos" },
  namer: { name: "Bautista", icon: "PenLine", rarity: "Común", description: "Ponle nombre a un gato" },
  notekeeper: { name: "Anotador", icon: "NotebookPen", rarity: "Común", description: "Añade una nota a un gato" },
  share_first: { name: "Embajador", icon: "Globe", rarity: "Común", description: "Comparte una captura" },
};
