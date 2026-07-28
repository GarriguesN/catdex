// Achievement definitions for display — no DB dependency (safe for client components)

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
