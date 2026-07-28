"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Volume2 } from "lucide-react";
import { ToggleChip } from "@/components/ui/Chip";
import { areSoundsEnabled, setSoundsEnabled } from "@/lib/sound-prefs";
import { playCaptureSound } from "@/lib/sounds";

interface SavedScreenProps {
  catId: string;
  photoUrl: string;
  onContinue?: () => void;
}

const FLASH_KEY = "catdex_flash_enabled";
const CONFETTI_COLORS = ["#FF8A26", "#FFA54A", "#3DBE7B", "#222326"];

export function SavedScreen({ catId, photoUrl, onContinue }: SavedScreenProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const flashEnabled = localStorage.getItem(FLASH_KEY) !== "0";
    const soundEnabled = areSoundsEnabled();
    setFlashOn(flashEnabled);
    setSoundOn(soundEnabled);

    // Flash effect + shutter feedback
    if (flashEnabled) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 450);
    }
    if (soundEnabled) playCaptureSound();

    // Confetti
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 3 + Math.random() * 5,
      });
    }

    let frameId: number;
    const { width, height } = canvas;
    function animate() {
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      for (const p of particles) {
        if (p.y > height + 20) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) frameId = requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, width, height);
    }
    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, []);

  function toggleFlash() {
    setFlashOn((on) => {
      localStorage.setItem(FLASH_KEY, on ? "0" : "1");
      return !on;
    });
  }

  function toggleSound() {
    setSoundOn((on) => {
      setSoundsEnabled(!on);
      return !on;
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-catdex-cream flex flex-col">
      {/* Flash overlay */}
      {showFlash && <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-10" />}

      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center flex-1 px-6">
        {/* Photo with checkmark badge */}
        <div className="relative mb-7 animate-pop-in">
          <div className="w-48 h-60 rounded-3xl overflow-hidden shadow-card bg-catdex-input-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Gato capturado" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-[#3DBE7B] border-4 border-catdex-cream flex items-center justify-center shadow-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-catdex-text mb-6">¡Gato guardado!</h2>

        {/* Flash + Sound toggle chips */}
        <div className="flex items-center gap-3 mb-8">
          <ToggleChip active={flashOn} onClick={toggleFlash}>
            <Zap className="h-3.5 w-3.5" /> Flash
          </ToggleChip>
          <ToggleChip active={soundOn} onClick={toggleSound}>
            <Volume2 className="h-3.5 w-3.5" /> Sonido
          </ToggleChip>
        </div>

        <button onClick={() => router.push(`/cat?id=${catId}`)} className="btn-primary w-full max-w-xs">
          Ver ficha
        </button>
        <button
          onClick={() => (onContinue ? onContinue() : window.location.reload())}
          className="btn-ghost mt-3"
        >
          Seguir capturando
        </button>
      </div>
    </div>
  );
}
