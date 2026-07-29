"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { isIOS as checkIOS, isStandalonePWA } from "@/lib/pwa";

/** Chrome fires this on installable pages; not in any standard lib.dom.d.ts. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Add to Home Screen" banner.
 * iOS has no install API, so it gets manual Share-sheet instructions.
 * Android/Chrome gets a real "Instalar" button wired to beforeinstallprompt.
 */
export function InstallBanner() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalonePWA() || sessionStorage.getItem("catdex_a2hs_dismissed")) return;

    if (checkIOS()) {
      setPlatform("ios");
      // Delay to avoid showing during initial load
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: only fires if the page passes Chrome's installability
    // checks (manifest + service worker) — no need to sniff the UA ourselves.
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem("catdex_a2hs_dismissed", "1");
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (!visible || !platform) return null;

  return (
    <div className="fixed bottom-28 left-4 right-4 z-50 card p-4 animate-pop-in shadow-float sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
      <button onClick={dismiss} className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-catdex-gray-light active:bg-catdex-input-bg">
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-catdex-orange/10 flex items-center justify-center shrink-0">
          {platform === "ios" ? (
            <Share2 className="h-4.5 w-4.5 text-catdex-orange" />
          ) : (
            <Download className="h-4.5 w-4.5 text-catdex-orange" />
          )}
        </span>
        {platform === "ios" ? (
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
        ) : (
          <div>
            <p className="text-sm font-semibold mb-1">Instala CatDex</p>
            <p className="text-xs text-catdex-text-muted leading-relaxed mb-2">
              Accede más rápido y úsala sin conexión.
            </p>
            <button
              onClick={install}
              className="inline-flex items-center gap-1.5 bg-catdex-orange text-white rounded-full px-4 py-2 text-xs font-semibold active:scale-95 transition-transform"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
