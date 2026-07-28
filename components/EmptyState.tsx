"use client";

import Link from "next/link";
import { Camera } from "lucide-react";

export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="w-20 h-20 rounded-full bg-catdex-orange/10 flex items-center justify-center mb-5">
        <Camera className="h-9 w-9 text-catdex-orange" />
      </div>
      <h2 className="text-xl font-bold text-catdex-text mb-2">Captura tu primer gato</h2>
      <p className="text-sm text-catdex-text-muted mb-7 max-w-xs leading-relaxed">
        Haz una foto a un gato callejero y empieza tu colección. Como una Pokédex, pero de gatos de
        verdad.
      </p>
      <Link href="/capture" className="btn-primary">
        <Camera className="h-4.5 w-4.5" />
        Capturar
      </Link>
    </div>
  );
}
