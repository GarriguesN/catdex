"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Volume2 } from "lucide-react";

interface SavedScreenProps {
  catId: string;
  photoUrl: string;
}

const CONFETTI_COLORS = ["#FC791A", "#6ABF95", "#222326", "#FFFFFF"];

export function SavedScreen({ catId, photoUrl }: SavedScreenProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flash, setFlash] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    // Flash effect (brief white overlay)
    const t = setTimeout(() => setFlash(false), 400);

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

    return () => { clearTimeout(t); cancelAnimationFrame(frameId); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF5EE] flex flex-col">
      {/* Flash overlay */}
      {flash && <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />}

      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center flex-1 px-6 space-y-6">
        {/* Photo with checkmark badge */}
        <div className="relative">
          <div className="w-48 h-64 rounded-2xl overflow-hidden border-2 border-[#222326]/20 shadow-lg">
            <img src={photoUrl} alt="Captured cat" className="w-full h-full object-cover" />
          </div>
          {/* Green checkmark badge overlapping bottom-right */}
          <div className="absolute -bottom-4 -right-4 w-10 h-10 rounded-full bg-[#6ABF95] border-4 border-[#FAF5EE] flex items-center justify-center shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-[#222326]">¡Capturado!</h2>

        {/* Toggle chips: Flash + Sound */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFlash(!flash)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
              flash ? "border-[#FC791A] text-[#FC791A] bg-[#FC791A]/5" : "border-[#A9A9A9]/30 text-[#A9A9A9]"
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Flash
          </button>
          <button
            onClick={() => setSound(!sound)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
              sound ? "border-[#FC791A] text-[#FC791A] bg-[#FC791A]/5" : "border-[#A9A9A9]/30 text-[#A9A9A9]"
            }`}
          >
            <Volume2 className="h-3.5 w-3.5" /> Sonido
          </button>
        </div>

        {/* Primary CTA */}
        <button onClick={() => router.push(`/cat?id=${catId}`)} className="btn-pokedex w-full">
          Ver ficha
        </button>

        {/* Secondary CTA */}
        <button onClick={() => router.push("/capture")} className="text-sm text-[#686868] hover:text-[#222326] font-medium">
          Seguir capturando
        </button>
      </div>
    </div>
  );
}
