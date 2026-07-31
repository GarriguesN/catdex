"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { Toggle } from "@/components/ui/Toggle";
import { isDebugCameraEnabled, setDebugCameraEnabled } from "@/lib/debug-prefs";

export default function DebugPage() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isDebugCameraEnabled());
  }, []);

  function update(value: boolean) {
    setEnabled(value);
    setDebugCameraEnabled(value);
  }

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Modo debug" />

      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-[0.9375rem] font-medium">Datos de cámara</p>
            <p className="text-[0.8125rem] text-catdex-text-muted leading-snug">
              Muestra nitidez, detección y confianza en cada captura
            </p>
          </div>
          <Toggle checked={enabled} onChange={update} label="Datos de cámara" />
        </div>
      </div>
    </div>
  );
}
