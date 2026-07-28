"use client";

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
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${photoUrl})` }}
      />
      <div className="absolute inset-0 bg-[#36312C]/85 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center flex-1 px-6">
        {/* X close */}
        <button onClick={onClose} className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center text-white/80 hover:text-white">
          <XIcon />
        </button>

        {/* Icon: dark circle with wave icon + partial orange arc */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-[#211F1C] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 12c1.5-4 4.5-6 10-6s8.5 2 10 6" />
              <path d="M4 12c1-2.5 3-4 8-4s7 1.5 8 4" />
              <path d="M6 12c.5-1.5 2-2 6-2s5.5.5 6 2" />
            </svg>
          </div>
          {/* Partial orange arc — simulates severity indicator */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96" fill="none" stroke="#FC791A" strokeWidth="3" strokeLinecap="round">
            <path d="M48 8 A40 40 0 0 1 88 48" />
          </svg>
        </div>

        {/* Title + subtitle (rotating copies) */}
        <h2 className="text-2xl font-bold text-white text-center mb-3">{title}</h2>
        <p className="text-sm text-white/60 text-center max-w-xs leading-relaxed">{subtitle}</p>
      </div>

      {/* Bottom button */}
      <div className="relative p-6 pb-8">
        <button onClick={onRetry} className="btn-pokedex w-full">Intentar de nuevo</button>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
