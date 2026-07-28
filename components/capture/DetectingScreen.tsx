"use client";

export function DetectingScreen({ photoUrl }: { photoUrl: string }) {
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
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-8">Analizando la criatura…</h2>

        {/* Icon: dark circle with cat silhouette + progress ring */}
        <div className="relative mb-10">
          <div className="w-24 h-24 rounded-full bg-[#211F1C] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FC791A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" />
              <path d="M8 14v.5" /><path d="M16 14v.5" /><path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />
            </svg>
          </div>
          {/* Progress ring — indeterminate animated orange arc */}
          <svg className="absolute inset-0 animate-spin" viewBox="0 0 96 96" fill="none">
            <circle cx="48" cy="48" r="42" stroke="#302D28" strokeWidth="3" fill="none" />
            <circle cx="48" cy="48" r="42" stroke="#FC791A" strokeWidth="3" fill="none"
              strokeDasharray="180 264" strokeLinecap="round" />
          </svg>
        </div>

        {/* Checklist: 3 steps */}
        <div className="space-y-3 w-full max-w-[240px]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#6ABF95] flex items-center justify-center flex-shrink-0">
              <CheckIcon />
            </div>
            <span className="text-sm text-white/70">Foto tomada</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#6ABF95] flex items-center justify-center flex-shrink-0">
              <CheckIcon />
            </div>
            <span className="text-sm text-white/70">Nitidez correcta</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#FC791A] flex items-center justify-center flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="text-sm text-white font-medium">¿Es un gato?</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
