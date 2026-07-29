// lib/copy.ts
// Copys "pokemizados" para el flujo de captura de CatDex.
// Mensajes rotativos: si el usuario falla varias veces seguidas
// (blur o "no es gato"), no se repite siempre la misma frase.

export const CAPTURE_COPY = {
  blurFail: {
    variants: [
      {
        title: "¡Uy, por poco!",
        subtitle: "Se movió antes de que lo enfocaras bien. Inténtalo de nuevo.",
      },
      {
        title: "¡Se movió justo a tiempo!",
        subtitle: "La imagen salió borrosa — prueba a mantener el móvil más firme.",
      },
      {
        title: "¡Casi lo tenías!",
        subtitle: "Un poco más de calma y lo atrapas seguro.",
      },
      {
        title: "¡Se ha movido el objetivo!",
        subtitle: "Espera a que se quede quieto o acércate despacio.",
      },
    ],
  },

  notCatFail: {
    generic: [
      {
        title: "¡Se ha escapado!",
        subtitle: "No hemos detectado ningún gato salvaje en la foto.",
      },
      {
        title: "¡Uy, aquí no hay nadie!",
        subtitle: "Prueba a acercarte más o a esperar a que el gato salga.",
      },
      {
        title: "¡Falsa alarma!",
        subtitle: "Esto no parece un gato. Vuelve a intentarlo.",
      },
    ],
    specific: (animalEs: string) => ({
      title: `¡Eso es un ${animalEs}, no cuenta!`,
      subtitle: "Solo los gatos entran en la CatDex.",
    }),
  },

  success: {
    title: "¡Capturado!",
    ctaPrimary: "Ver ficha",
    ctaSecondary: "Seguir capturando",
  },
};

// --- Helpers de rotación (evitan repetir la misma frase 2 veces) ---

let lastBlurIndex = -1;
export function getBlurCopy() {
  const { variants } = CAPTURE_COPY.blurFail;
  const index = pickDifferentIndex(variants.length, lastBlurIndex);
  lastBlurIndex = index;
  return variants[index];
}

let lastNotCatIndex = -1;
// classifyPhoto() returns confidence on a 0-100 scale (see lib/classifier.ts).
const CONFIDENCE_THRESHOLD = 50;

/**
 * Whether the top prediction is a recognized animal we have Spanish copy
 * for. Single source of truth — also drives which icon NotCatScreen shows,
 * so it must stay in sync with getNotCatCopy's specific/generic branch.
 */
export function isKnownAnimal(topLabel?: string, confidence?: number): boolean {
  if (!topLabel || !confidence || confidence <= CONFIDENCE_THRESHOLD) return false;
  return !!ANIMAL_LABELS_ES[topLabel.toLowerCase()];
}

export function getNotCatCopy(topLabel?: string, confidence?: number) {
  if (isKnownAnimal(topLabel, confidence)) {
    const animalEs = ANIMAL_LABELS_ES[topLabel!.toLowerCase()];
    return CAPTURE_COPY.notCatFail.specific(animalEs);
  }
  const { generic } = CAPTURE_COPY.notCatFail;
  const index = pickDifferentIndex(generic.length, lastNotCatIndex);
  lastNotCatIndex = index;
  return generic[index];
}

function pickDifferentIndex(length: number, lastIndex: number): number {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  while (index === lastIndex) {
    index = Math.floor(Math.random() * length);
  }
  return index;
}

// Matches the COCO class vocabulary coco-ssd detects (see lib/classifier.ts) —
// its 80 classes are coarser than ImageNet's (no raccoon/fox/squirrel/hen).
export const ANIMAL_LABELS_ES: Record<string, string> = {
  dog: "perro",
  bird: "pájaro",
  horse: "caballo",
  sheep: "oveja",
  cow: "vaca",
  elephant: "elefante",
  bear: "oso",
  zebra: "cebra",
  giraffe: "jirafa",
};
