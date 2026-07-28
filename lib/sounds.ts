/**
 * Sound effects via Web Audio API — synthesized, no external files.
 * 100% offline, <1KB, works in all browsers.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Play a simple tone — used for UI feedback.
 */
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume: number = 0.08
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — silent fail
  }
}

/**
 * Pokédex-style capture jingle — ascending notes.
 */
export function playCaptureSound() {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.12, "square", 0.06), i * 80);
  });
}

/**
 * Badge unlock fanfare — triumphant ascending arpeggio.
 */
export function playBadgeSound() {
  const notes = [523, 659, 784, 1047, 1319, 1568]; // C5, E5, G5, C6, E6, G6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, "triangle", 0.07), i * 100);
  });
}

/**
 * Error / "se escapó" sound — descending.
 */
export function playMissSound() {
  const notes = [440, 370, 311]; // A4, F#4, Eb4
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, "sawtooth", 0.04), i * 120);
  });
}

/**
 * UI click / tap feedback.
 */
export function playClickSound() {
  playTone(880, 0.05, "square", 0.03);
}

/**
 * Shutter sound when taking a photo.
 */
export function playShutterSound() {
  playTone(1200, 0.08, "square", 0.05);
  setTimeout(() => playTone(800, 0.06, "square", 0.04), 40);
}

/**
 * Check if sound is enabled in settings.
 */
export async function isSoundEnabled(): Promise<boolean> {
  try {
    const { db } = await import("@/lib/db");
    const setting = await db.settings.get("sound");
    return setting?.value !== false; // default: enabled
  } catch {
    return true;
  }
}

/**
 * Play a sound only if enabled in settings.
 */
export async function playIfEnabled(
  soundFn: () => void
): Promise<void> {
  if (await isSoundEnabled()) {
    soundFn();
  }
}
