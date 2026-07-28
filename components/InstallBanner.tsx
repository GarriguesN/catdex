"use client";

import { useEffect, useState } from "react";
import { Share2, X } from "lucide-react";

/**
 * iOS "Add to Home Screen" banner.
 * Only shows on iOS Safari (not in standalone mode), once per session.
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only on iOS Safari, not in standalone mode
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = sessionStorage.getItem("catdex_a2hs_dismissed");

    if (isIOS && !isStandalone && !dismissed) {
      // Delay to avoid showing during initial load
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem("catdex_a2hs_dismissed", "1");
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-16 left-3 right-3 z-50 bg-pokedex-gray-dark border border-pokedex-yellow/30 rounded-xl p-4 animate-pop-in shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-pokedex-gray-mid"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3">
        <Share2 className="h-5 w-5 text-pokedex-yellow flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold mb-1">
            Instala CatDex en tu iPhone
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Toca <span className="text-pokedex-yellow">Compartir</span>{" "}
            <span className="text-xs">↗</span> y luego{" "}
            <strong>Añadir a pantalla de inicio</strong>.
            Así no perderás tus gatos aunque pase una semana sin abrir la app.
          </p>
          <button
            onClick={dismiss}
            className="text-xs text-pokedex-blue hover:underline"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
