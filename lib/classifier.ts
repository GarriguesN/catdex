/**
 * Photo quality/content gate using MobileNet classification.
 *
 * MobileNet was trained on ImageNet — it's excellent at answering
 * "is this a cat?" (classification), even though it can't answer
 * "WHICH cat is this?" (re-identification). We use it as a gate:
 * reject non-cat photos and warn on low-confidence shots.
 */

// ImageNet classes that are cat-related (synset IDs from ImageNet)
// We check if the top prediction matches any of these
const CAT_CLASSES = new Set([
  "tabby",
  "tiger cat",
  "Persian cat",
  "Siamese cat",
  "Egyptian cat",
  "tiger",
  "lynx",
  "leopard",
  "snow leopard",
  "jaguar",
  "cheetah",
  "lion",
  "cougar",
  "cat", // generic catch
  "domestic cat",
  "kitty",
  "kitten",
  "alley cat",
  "stray",
]);

/**
 * Check if an ImageNet class name is cat-related.
 * We use substring matching because MobileNet's class names
 * may vary (e.g., "tabby, tabby cat" vs "tabby cat").
 */
function isCatClass(className: string): boolean {
  const lower = className.toLowerCase();
  // Direct match
  if (CAT_CLASSES.has(lower)) return true;
  // Substring match for composite names
  for (const catClass of CAT_CLASSES) {
    if (lower.includes(catClass)) return true;
  }
  // Cat-related keywords for detection
  const catKeywords = ["cat", "tabby", "kitten", "kitty", "feline", "tiger", "lion", "lynx", "leopard", "cheetah", "jaguar", "cougar", "panther", "ocelot", "bobcat", "caracal"];
  return catKeywords.some((kw) => lower.includes(kw));
}

// Pokédex-style messages — playful, thematic, with actionable hints
const POKEDEX_MESSAGES = {
  not_cat: [
    "¡Se te ha escapado! Esto no es un gato… 🍃",
    "¡Oh! Parece que no era un Pokémon gatuno… 🐶",
    "¡Vaya! Eso no ronronea. Apunta mejor 🔭",
    "La Pokédex no reconoce esta criatura… ¿seguro que es un gato? 🤔",
  ],
  blurry: [
    "¡Está muy lejos! Intenta acercarte más 🔍",
    "No se ve bien… ¿pruebas desde otro ángulo? 📐",
    "¡Demasiado borroso! Como cuando se mueven de repente 💨",
    "Así no hay quien lo identifique… ¡Acércate un poco! 🐾",
  ],
  low_confidence: [
    "Mmm… no está claro. ¿Repetimos la foto? 📸",
    "Podría ser un gato… o una bolsa de basura. Mejor otra foto 🗑️",
    "Los gatos son escurridizos. ¿Pruebas otra vez? 🐱",
    "No termino de verlo claro… ¿Le haces otra? 👀",
  ],
  not_cat_hard: "¡Un {class} salvaje apareció! Pero… esto es CatDex, no {class}Dex 😅",
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface ClassificationResult {
  isCat: boolean;
  topClass: string;
  confidence: number; // 0-100
  quality: "good" | "blurry" | "not_cat" | "low_confidence";
  message?: string;
}

let modelPromise: Promise<any> | null = null;
let modelCache: any = null;

/**
 * Lazy-load MobileNet (only when a photo needs validation).
 * Model is ~5MB, loaded once and cached.
 */
async function getModel() {
  if (modelCache) return modelCache;
  if (!modelPromise) {
    // Dynamic import — only loads when called. tfjs must be ready (backend
    // registered) before mobilenet.load(), otherwise classify() throws
    // "No backend found in registry".
    modelPromise = import("@tensorflow/tfjs").then(async (tf) => {
      await tf.ready();
      const mobilenet = await import("@tensorflow-models/mobilenet");
      return mobilenet.load({ version: 2, alpha: 0.5 });
    });
  }
  modelCache = await modelPromise;
  return modelCache;
}

/**
 * Classify a photo and check if it's a cat.
 * Returns classification result with quality assessment.
 */
export async function classifyPhoto(
  imageElement: HTMLImageElement
): Promise<ClassificationResult> {
  try {
    const model = await getModel();
    const predictions = await model.classify(imageElement, 3);

    if (!predictions || predictions.length === 0) {
      return {
        isCat: false,
        topClass: "unknown",
        confidence: 0,
        quality: "low_confidence",
        message: "No se pudo analizar la foto. ¿Seguro que es un gato?",
      };
    }

    const top = predictions[0];
    const isCat = isCatClass(top.className);
    const confidence = top.probability * 100;

    if (!isCat) {
      // Try to extract a friendly name from the class
      const shortClass = top.className.split(",")[0].trim();
      const hardMessage = POKEDEX_MESSAGES.not_cat_hard
        .replace(/\{class\}/g, shortClass);
      return {
        isCat: false,
        topClass: top.className,
        confidence,
        quality: "not_cat",
        message: hardMessage,
      };
    }

    if (confidence < 40) {
      return {
        isCat: true,
        topClass: top.className,
        confidence,
        quality: "blurry",
        message: pickRandom(POKEDEX_MESSAGES.blurry),
      };
    }

    if (confidence < 70) {
      return {
        isCat: true,
        topClass: top.className,
        confidence,
        quality: "low_confidence",
        message: pickRandom(POKEDEX_MESSAGES.low_confidence),
      };
    }

    return {
      isCat: true,
      topClass: top.className,
      confidence,
      quality: "good",
    };
  } catch (err) {
    console.warn("MobileNet classification failed:", err);
    // Fail open — don't block the user if the model fails
    return {
      isCat: true,
      topClass: "unknown",
      confidence: 0,
      quality: "good",
    };
  }
}
