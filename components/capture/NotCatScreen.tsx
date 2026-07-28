"use client";

import { X } from "lucide-react";

interface NotCatScreenProps {
  title: string;
  subtitle: string;
  isSpecific: boolean; // true = detected specific animal (show dog icon)
  photoUrl: string;
  onRetry: () => void;
  onUseAnyway: () => void;
  onClose: () => void;
}

export function NotCatScreen({ title, subtitle, isSpecific, photoUrl, onRetry, onUseAnyway, onClose }: NotCatScreenProps) {
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

        {/* White circle with dog / question icon */}
        <div className="mb-8">
          <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-float">
            {isSpecific ? <DogIcon /> : <NeutralIcon />}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-3">{title}</h2>
        <p className="text-sm text-white/60 text-center max-w-xs leading-relaxed">{subtitle}</p>
      </div>

      {/* Bottom buttons */}
      <div className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-2">
        <button onClick={onRetry} className="btn-primary w-full">
          Intentar de nuevo
        </button>
        <button
          onClick={onUseAnyway}
          className="w-full py-3 text-white/90 font-semibold text-sm transition-colors active:text-white"
        >
          Usar de todas formas
        </button>
      </div>
    </div>
  );
}

function DogIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#222326" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.7 1.04.862 1.1 1.1.5.38 1.4.64 1.9 3.4.15.846 1.1 1.1 1.5.5.56-.84.9-1.6 2-3 1.285-1.636 2.5-2.232 4-2s2.715.364 4 2c1.1 1.4 1.44 2.16 2 3 .4.6 1.35.346 1.5-.5.5-2.76 1.4-3.02 1.9-3.4.06-.238 1.02-.4 1.1-1.1.113-.994-1.177-6.53-4-7-1.923-.321-3.5.782-3.5 2.172" />
      <path d="M10 15v2" />
      <path d="M14 15v2" />
      <path d="M12 12v.01" />
      <path d="M9 9v.01" />
      <path d="M15 9v.01" />
    </svg>
  );
}

function NeutralIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#222326" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
