"use client";

import { X } from "lucide-react";

interface BlurCheckScreenProps {
  title: string;
  subtitle: string;
  photoUrl: string;
  onRetry: () => void;
  onClose: () => void;
}

export function BlurCheckScreen({ title, subtitle, photoUrl, onRetry, onClose }: BlurCheckScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Dark overlay with photo background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photoUrl})` }} />
      <div className="absolute inset-0 bg-[#36312C]/85 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center flex-1 px-6">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full text-white/80 bg-white/10"
          style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon: dark circle with wave + partial orange arc (severity) */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-[#211F1C] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
              <path d="M2 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.5" />
            </svg>
          </div>
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96" fill="none" stroke="#FF8A26" strokeWidth="4" strokeLinecap="round">
            <path d="M48 4 A44 44 0 0 1 92 48" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-3">{title}</h2>
        <p className="text-sm text-white/60 text-center max-w-xs leading-relaxed">{subtitle}</p>
      </div>

      {/* Bottom button */}
      <div className="relative px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button onClick={onRetry} className="btn-primary w-full">
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
