"use client";

export function DetectingScreen({ photoUrl }: { photoUrl: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Dark overlay with photo background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photoUrl})` }} />
      <div className="absolute inset-0 bg-[#36312C]/85 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center flex-1 px-6">
        <h2 className="text-2xl font-bold text-white mb-9">Detectando…</h2>

        {/* Cat silhouette in dark circle + orange progress ring */}
        <div className="relative mb-10">
          <div className="w-24 h-24 rounded-full bg-[#211F1C] flex items-center justify-center">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" />
              <path d="M8 14v.5" />
              <path d="M16 14v.5" />
              <path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />
            </svg>
          </div>
          <svg className="absolute inset-0 animate-spin" viewBox="0 0 96 96" fill="none">
            <circle cx="48" cy="48" r="44" stroke="#302D28" strokeWidth="4" fill="none" />
            <circle cx="48" cy="48" r="44" stroke="#FF8A26" strokeWidth="4" fill="none" strokeDasharray="190 276" strokeLinecap="round" />
          </svg>
        </div>

        {/* Checklist */}
        <div className="space-y-3.5 w-full max-w-[250px]">
          <ChecklistItem state="done" label="Foto tomada" />
          <ChecklistItem state="done" label="Nitidez correcta" />
          <ChecklistItem state="active" label="¿Es un gato?" />
          <ChecklistItem state="pending" label="Buscando coincidencias" />
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ state, label }: { state: "done" | "active" | "pending"; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {state === "done" ? (
        <span className="w-5 h-5 rounded-full bg-[#3DBE7B] flex items-center justify-center shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : state === "active" ? (
        <span className="w-5 h-5 rounded-full bg-[#FF8A26] flex items-center justify-center shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-white/25 shrink-0" />
      )}
      <span className={state === "active" ? "text-sm text-white font-medium" : state === "done" ? "text-sm text-white/70" : "text-sm text-white/40"}>
        {label}
      </span>
    </div>
  );
}
