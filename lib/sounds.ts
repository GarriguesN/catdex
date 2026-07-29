/**
 * Sound effects via Web Audio API — synthesized, no external files.
 * 100% offline, <1KB, works in all browsers.
 */

import { areSoundsEnabled } from "@/lib/sound-prefs";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, dur: number, type: OscillatorType = "square", vol: number = 0.08) {
  if (!areSoundsEnabled()) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch { /* silent */ }
}

/** Triumphant "you caught it!" chime — rising major arpeggio landing on a bright sparkle. */
export function playCaptureSound() {
  const notes: [freq: number, delayMs: number, dur: number, vol: number][] = [
    [523.25, 0, 0.14, 0.07], // C5
    [659.25, 90, 0.14, 0.07], // E5
    [783.99, 180, 0.16, 0.08], // G5
    [1046.5, 280, 0.28, 0.1], // C6 — the "landing" note, held longer
    [1567.98, 310, 0.22, 0.06], // G6 — sparkle, overlapping the landing note
  ];
  for (const [freq, delay, dur, vol] of notes) {
    setTimeout(() => playTone(freq, dur, "triangle", vol), delay);
  }
}

export function playBadgeSound() {
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => playTone(f, 0.15, "triangle", 0.07), i * 100));
}

export function playMissSound() {
  [440, 370, 311].forEach((f, i) => setTimeout(() => playTone(f, 0.15, "sawtooth", 0.04), i * 120));
}

export function playClickSound() {
  playTone(880, 0.05, "square", 0.03);
}

export function playShutterSound() {
  playTone(1200, 0.08, "square", 0.05);
  setTimeout(() => playTone(800, 0.06, "square", 0.04), 40);
}
