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
    <div className="fixed bottom-28 left-4 right-4 z-50 card p-4 animate-pop-in shadow-float sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
      <button onClick={dismiss} className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-catdex-gray-light active:bg-catdex-input-bg">
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-catdex-orange/10 flex items-center justify-center shrink-0">
          <Share2 className="h-4.5 w-4.5 text-catdex-orange" />
        </span>
        <div>
          <p className="text-sm font-semibold mb-1">Instala CatDex en tu iPhone</p>
          <p className="text-xs text-catdex-text-muted leading-relaxed mb-2">
            Toca <span className="font-semibold text-catdex-orange">Compartir</span> y luego{" "}
            <strong>Añadir a pantalla de inicio</strong>. Así no perderás tus gatos.
          </p>
          <button onClick={dismiss} className="text-xs font-semibold text-catdex-orange">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
