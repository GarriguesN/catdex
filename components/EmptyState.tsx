"use client";

import Link from "next/link";

export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="text-6xl mb-4">🐱</div>
      <h2 className="text-xl font-bold mb-2">¡Atrapa tu primer gato!</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Haz una foto a un gato callejero y empieza tu colección.
        Como una Pokédex, pero de gatos de verdad.
      </p>
      <Link href="/capture" className="btn-pokedex inline-flex items-center gap-2">
        <span className="text-lg">📸</span>
        + Atrapar
      </Link>
    </div>
  );
}
