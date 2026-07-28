// Cat name generator — Pokédex-style random names

const NAMES = [
  "Miautrón", "Miaukira", "Miauzoide", "Miaufu", "Miaulix",
  "Miaupon", "Miauko", "Miauvex", "Miaudino", "Miaupolis",
  "Ronronix", "Ronrontor", "Ronronko", "Ronronvex", "Ronronzo",
  "Ronronblim", "Ronrondú", "Purrasoide", "Purrafu", "Purralix",
  "Bigotrix", "Bigofú", "Bigolix", "Bigonko", "Bigovex",
  "Bigudín", "Zarpazo", "Zarpix", "Zarpolo", "Zarpotrón",
  "Garruko", "Garravex", "Garrafú", "Garrolix", "Patatrón",
  "Patoide", "Patix", "Patuko", "Uñix", "Uñako",
  "Pelusoide", "Pelufix", "Peluko", "Pelutrix", "Grisix",
  "Grisoide", "Grisotrón", "Negrix", "Negroide", "Negrotrón",
  "Blancoide", "Blancix", "Blancotrón", "Naranjix", "Naranjoide",
  "Naranjotrón", "Manchix", "Manchoide", "Rayadix", "Rayadoide",
  "Rayogato", "Rayix", "Rayoko", "Rayotrón", "Sombragato",
  "Sombrix", "Sombrako", "Sombravex", "Lunagato", "Lunix",
  "Lunako", "Lunatrix", "Solgato", "Solix", "Soloko",
  "Solotrón", "Nochegato", "Nochix", "Nochevex", "Nochilux",
  "Tigrix", "Tigroide", "Tigrotrón", "Leonix", "Leonoide",
  "Leonko", "Pantix", "Pantoide", "Pantrofú", "Felinix",
  "Felinoide", "Felinko", "Bastetrix", "Sekhmix", "Mafdetrón",
  "Cazatrix", "Cazoide", "Cazavex", "Saltix", "Saltoide",
  "Saltotrón", "Traviesix", "Traviesoide", "Siestix", "Siestoide",
  "Ratonix", "Ratolix", "Vagabix", "Vagaboide", "Vagabundrix",
  "Callejerix", "Trotamix", "Errantix", "Furtivix", "Sigilix",
  "Croquetix", "Croquetoide", "Atunix", "Atunko", "Atuntrón",
  "Sardinix", "Sardinoide", "Pescadix", "Lechix", "Lechoide",
  "Salmonix", "Salmonoide", "Bocatix", "Caramelix", "Galletix",
  "Canelix", "Tunix", "Bonitix",
  "Ovillix", "Ovilloide", "Ovillotrón", "Cajix", "Cajoide",
  "Cajotrón", "Tecladix", "Tecladoide", "Ventanix", "Ventanoide",
  "Tejadix", "Tejadoide", "Callejix", "Callejoide", "Colonix",
  "Colonoide", "Azoteix", "Aleroide",
];

const usedInSession = new Set<string>();

export function generateCatName(): string {
  const available = NAMES.filter(n => !usedInSession.has(n));
  if (available.length > 0) {
    const name = available[Math.floor(Math.random() * available.length)];
    usedInSession.add(name);
    return name;
  }
  const suffix = ["II", "III", "Jr.", "Sr.", "el Bueno"][Math.floor(Math.random() * 5)];
  const base = NAMES[Math.floor(Math.random() * NAMES.length)];
  return `${base} ${suffix}`;
}
