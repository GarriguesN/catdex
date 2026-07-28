"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { Toggle } from "@/components/ui/Toggle";
import { areSoundsEnabled, setSoundsEnabled } from "@/lib/sound-prefs";
import { playCaptureSound } from "@/lib/sounds";

export default function SoundsPage() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(areSoundsEnabled());
  }, []);

  function update(value: boolean) {
    setEnabled(value);
    setSoundsEnabled(value);
    if (value) playCaptureSound();
  }

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Sonidos" />

      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-[0.9375rem] font-medium">Sonidos de captura</p>
            <p className="text-[0.8125rem] text-catdex-text-muted leading-snug">
              Obturador y melodía al guardar un gato
            </p>
          </div>
          <Toggle checked={enabled} onChange={update} label="Sonidos de captura" />
        </div>
      </div>
    </div>
  );
}
