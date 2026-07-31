/**
 * Photo quality/content gate using coco-ssd object detection.
 *
 * We used to run MobileNet (whole-image ImageNet classification) here, but
 * that answers "what's the single dominant subject of this photo?" — with a
 * hand, background, or phone screen in frame it gets confidently wrong, and
 * even on a clean cat photo the lightweight variant we used often scored the
 * top guess at just ~8%. coco-ssd instead *detects* objects (with boxes +
 * per-object scores) among COCO's 80 classes, one of which is "cat" — a hand
 * in the foreground doesn't drown out a cat elsewhere in frame the way it
 * did for a single whole-image classification.
 */

// Pokédex-style messages — playful, thematic, with actionable hints
const POKEDEX_MESSAGES = {
  not_cat: [
    "¡Se te ha escapado! Esto no es un gato… 🍃",
    "¡Oh! Parece que no era un Pokémon gatuno… 🐶",
    "¡Vaya! Eso no ronronea. Apunta mejor 🔭",
    "La Pokédex no reconoce esta criatura… ¿seguro que es un gato? 🤔",
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
  /** All raw detections (class + score%), most confident first — debug only. */
  detections?: { class: string; score: number }[];
}

// A "cat" detection below this score is too weak to trust outright — ask for
// a retake instead of accepting or hard-rejecting.
const GOOD_CAT_SCORE = 50;
// Detect() is asked for anything down to this score so we can tell "weakly
// detected a cat" apart from "detected nothing cat-like at all" — coco-ssd's
// own default (0.5) would silently hide that distinction from us.
const MIN_DETECT_SCORE = 0.15;

let modelPromise: Promise<any> | null = null;
let modelCache: any = null;

/**
 * Lazy-load coco-ssd (only when a photo needs validation).
 */
async function getModel() {
  if (modelCache) return modelCache;
  if (!modelPromise) {
    const t0 = performance.now();
    // Dynamic import — only loads when called. tfjs must be ready (backend
    // registered) before coco-ssd.load(), otherwise detect() throws
    // "No backend found in registry".
    modelPromise = import("@tensorflow/tfjs").then(async (tf) => {
      await tf.ready();
      console.log(`[classifier] tfjs backend registered: "${tf.getBackend()}"`);
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      console.log(`[classifier] coco-ssd loaded in ${(performance.now() - t0).toFixed(0)}ms`);
      return model;
    });
  }
  modelCache = await modelPromise;
  return modelCache;
}

/**
 * Kick off the coco-ssd download + WebGL shader compilation ahead of time
 * (e.g. as soon as the capture screen mounts) instead of on the first
 * shutter press. Loading is ~20s of real (mostly main-thread) work the
 * first time — without this, that entire load blocks the "Detectando…"
 * screen right after the user takes their first photo, freezing its
 * spinner and making the app look hung. Safe to call multiple times and
 * to ignore the result; classifyPhoto() awaits the same cached promise.
 */
export function preloadClassifier(): void {
  getModel().catch((err) => console.warn("[classifier] preload failed:", err));
}

/**
 * Detect objects in a photo and check if a cat is among them.
 * Returns classification result with quality assessment.
 */
export async function classifyPhoto(
  imageElement: HTMLImageElement
): Promise<ClassificationResult> {
  const t0 = performance.now();
  console.log(
    `[classifier] detecting objects in image ${imageElement.naturalWidth}x${imageElement.naturalHeight}`
  );
  try {
    const model = await getModel();
    const detections = await model.detect(imageElement, 20, MIN_DETECT_SCORE);
    const sorted = [...detections].sort((a: any, b: any) => b.score - a.score);
    console.log(
      `[classifier] detections (${(performance.now() - t0).toFixed(0)}ms):`,
      sorted.map((d: any) => `${d.class} (${(d.score * 100).toFixed(1)}%)`)
    );

    const debugDetections = sorted.map((d: any) => ({ class: d.class, score: Math.round(d.score * 1000) / 10 }));
    const catDetections = sorted.filter((d: any) => d.class === "cat");

    if (catDetections.length === 0) {
      const best = sorted[0];
      const confidence = best ? best.score * 100 : 0;
      console.log(
        `[classifier] decision: not_cat (no "cat" among detections` +
          (best ? `, best guess "${best.class}" at ${confidence.toFixed(1)}%)` : ", nothing detected at all)")
      );
      if (!best) {
        return {
          isCat: false,
          topClass: "unknown",
          confidence: 0,
          quality: "not_cat",
          message: pickRandom(POKEDEX_MESSAGES.not_cat),
          detections: debugDetections,
        };
      }
      return {
        isCat: false,
        topClass: best.class,
        confidence,
        quality: "not_cat",
        message: POKEDEX_MESSAGES.not_cat_hard.replace(/\{class\}/g, best.class),
        detections: debugDetections,
      };
    }

    const bestCat = catDetections[0];
    const confidence = bestCat.score * 100;
    console.log(`[classifier] cat detected at ${confidence.toFixed(1)}% (bbox=${bestCat.bbox.map((n: number) => n.toFixed(0))})`);

    if (confidence < GOOD_CAT_SCORE) {
      console.log(`[classifier] decision: low_confidence (cat score ${confidence.toFixed(1)}% < ${GOOD_CAT_SCORE}%)`);
      return {
        isCat: true,
        topClass: "cat",
        confidence,
        quality: "low_confidence",
        message: pickRandom(POKEDEX_MESSAGES.low_confidence),
        detections: debugDetections,
      };
    }

    console.log(`[classifier] decision: good (cat score ${confidence.toFixed(1)}% >= ${GOOD_CAT_SCORE}%)`);
    return {
      isCat: true,
      topClass: "cat",
      confidence,
      quality: "good",
      detections: debugDetections,
    };
  } catch (err) {
    console.warn("[classifier] coco-ssd detection threw — failing open:", err);
    // Fail open — don't block the user if the model fails
    return {
      isCat: true,
      topClass: "unknown",
      confidence: 0,
      quality: "good",
    };
  }
}
