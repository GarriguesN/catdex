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
  // Keywords
  const catKeywords = ["cat", "tabby", "kitten", "kitty", "feline", "tiger", "lion", "lynx", "leopard", "cheetah", "jaguar", "cougar", "panther", "ocelot", "bobcat", "caracal"];
  return catKeywords.some((kw) => lower.includes(kw));
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
    // Dynamic import — only loads when called
    modelPromise = import("@tensorflow-models/mobilenet").then((mobilenet) =>
      mobilenet.load({ version: 2, alpha: 0.5 })
    );
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
      return {
        isCat: false,
        topClass: top.className,
        confidence,
        quality: "not_cat",
        message: `Esto parece "${top.className}" (${confidence.toFixed(0)}%), no un gato. ¿Seguro que quieres guardarlo?`,
      };
    }

    if (confidence < 40) {
      return {
        isCat: true,
        topClass: top.className,
        confidence,
        quality: "blurry",
        message: `Parece un gato (${top.className}, ${confidence.toFixed(0)}%), pero la foto está borrosa o lejana. ¿Repetir?`,
      };
    }

    if (confidence < 70) {
      return {
        isCat: true,
        topClass: top.className,
        confidence,
        quality: "low_confidence",
        message: `Detectado como "${top.className}" con ${confidence.toFixed(0)}% de confianza. ¿Continuar?`,
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
