"use client";

import { X, Dog, HelpCircle } from "lucide-react";

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
            {isSpecific ? (
              <Dog className="h-9 w-9 text-catdex-text" strokeWidth={1.8} />
            ) : (
              <HelpCircle className="h-9 w-9 text-catdex-text" strokeWidth={1.8} />
            )}
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
