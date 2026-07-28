// Cat name generator — Pokédex-style random names

const NAMES = [
  // — Sonidos gatunos —
  "Miautrón", "Miaukira", "Miauzoide", "Miaufu", "Miaulix",
  "Miaupon", "Miauko", "Miauvex", "Miaudino", "Miaupolis",
  "Ronronix", "Ronrontor", "Ronronko", "Ronronvex", "Ronronzo",
  "Ronronblim", "Ronrondú", "Purrasoide", "Purrafu", "Purralix",

  // — Bigotes, garras y patas —
  "Bigotrix", "Bigofú", "Bigolix", "Bigonko", "Bigovex",
  "Bigudín", "Zarpazo", "Zarpix", "Zarpolo", "Zarpotrón",
  "Garruko", "Garravex", "Garrafú", "Garrolix", "Patatrón",
  "Patoide", "Patix", "Patuko", "Uñix", "Uñako",

  // — Colores y pelaje —
  "Pelusoide", "Pelufix", "Peluko", "Pelutrix", "Grisix",
  "Grisoide", "Grisotrón", "Negrix", "Negroide", "Negrotrón",
  "Blancoide", "Blancix", "Blancotrón", "Naranjix", "Naranjoide",
  "Naranjotrón", "Manchix", "Manchoide", "Rayadix", "Rayadoide",

  // — Fenómenos —
  "Rayogato", "Rayix", "Rayoko", "Rayotrón", "Sombragato",
  "Sombrix", "Sombrako", "Sombravex", "Lunagato", "Lunix",
  "Lunako", "Lunatrix", "Solgato", "Solix", "Soloko",
  "Solotrón", "Nochegato", "Nochix", "Nochevex", "Nochilux",

  // — Grandes felinos y mitología —
  "Tigrix", "Tigroide", "Tigrotrón", "Leonix", "Leonoide",
  "Leonko", "Pantix", "Pantoide", "Pantrofú", "Felinix",
  "Felinoide", "Felinko", "Bastetrix", "Sekhmix", "Mafdetrón",

  // — Comportamiento callejero —
  "Cazatrix", "Cazoide", "Cazavex", "Saltix", "Saltoide",
  "Saltotrón", "Traviesix", "Traviesoide", "Siestix", "Siestoide",
  "Ratonix", "Ratolix", "Vagabix", "Vagaboide", "Vagabundrix",
  "Callejerix", "Trotamix", "Errantix", "Furtivix", "Sigilix",

  // — Comida —
  "Croquetix", "Croquetoide", "Atunix", "Atunko", "Atuntrón",
  "Sardinix", "Sardinoide", "Pescadix", "Lechix", "Lechoide",
  "Salmonix", "Salmonoide", "Bocatix", "Caramelix", "Galletix",
  "Canelix", "Tunix", "Bonitix",

  // — Guaridas urbanas —
  "Ovillix", "Ovilloide", "Ovillotrón", "Cajix", "Cajoide",
  "Cajotrón", "Tecladix", "Tecladoide", "Ventanix", "Ventanoide",
  "Tejadix", "Tejadoide", "Callejix", "Callejoide", "Colonix",
  "Colonoide", "Azoteix", "Aleroide",
];

export async function generateCatName(): Promise<string> {
  const usedNames = await getUsedNames();
  const available = NAMES.filter((n) => !usedNames.has(n));

  if (available.length > 0) {
    const name = available[Math.floor(Math.random() * available.length)];
    await markNameUsed(name);
    return name;
  }

  // All names used — add suffix
  const suffix = ["II", "III", "Jr.", "Sr.", "el Bueno", "el Guapo"][
    Math.floor(Math.random() * 6)
  ];
  const base = NAMES[Math.floor(Math.random() * NAMES.length)];
  const name = `${base} ${suffix}`;
  await markNameUsed(name);
  return name;
}

async function getUsedNames(): Promise<Set<string>> {
  try {
    const entry = await db_get_setting("usedNames");
    if (entry) {
      return new Set(JSON.parse(entry as string));
    }
  } catch {
    // Not set yet
  }
  return new Set();
}

async function markNameUsed(name: string): Promise<void> {
  const used = await getUsedNames();
  used.add(name);
  await db_set_setting("usedNames", JSON.stringify([...used]));
}

// Local helpers (avoid circular imports)
async function db_get_setting(key: string): Promise<unknown | null> {
  const { db } = await import("./db");
  const s = await db.settings.get(key);
  return s?.value ?? null;
}

async function db_set_setting(key: string, value: unknown): Promise<void> {
  const { db } = await import("./db");
  await db.settings.put({ key, value });
}
