"use client";

import { useState, useCallback } from "react";
import { Camera, MapPin, Bell, Mic, Check } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Logo } from "@/components/ui/Logo";

const ONBOARDING_KEY = "catdex_onboarding_done";

type PermKey = "camera" | "location" | "notifications" | "microphone";
type PermStatus = "idle" | "granted" | "denied";

const PERMISSIONS: { key: PermKey; icon: ReactNode; title: string; description: string }[] = [
  { key: "camera", icon: <Camera className="h-5 w-5" />, title: "Cámara", description: "Para tomar fotos de gatos" },
  { key: "location", icon: <MapPin className="h-5 w-5" />, title: "Ubicación", description: "Para guardar dónde encuentras a los gatos" },
  { key: "notifications", icon: <Bell className="h-5 w-5" />, title: "Notificaciones", description: "Para recordatorios y logros" },
  { key: "microphone", icon: <Mic className="h-5 w-5" />, title: "Micrófono", description: "Para sonidos al capturar" },
];

interface OnboardingModalProps {
  onComplete: () => void;
}

/** Permissions screen — friendly cards, one large CTA. */
export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [status, setStatus] = useState<Record<PermKey, PermStatus>>({
    camera: "idle",
    location: "idle",
    notifications: "idle",
    microphone: "idle",
  });
  const [requesting, setRequesting] = useState(false);

  const request = useCallback(async (key: PermKey): Promise<PermStatus> => {
    let result: PermStatus = "denied";
    try {
      if (key === "camera" || key === "microphone") {
        const stream = await navigator.mediaDevices.getUserMedia(
          key === "camera" ? { video: true } : { audio: true }
        );
        stream.getTracks().forEach((t) => t.stop());
        result = "granted";
      } else if (key === "location") {
        result = await new Promise<PermStatus>((resolve) =>
          navigator.geolocation.getCurrentPosition(
            () => resolve("granted"),
            () => resolve("denied"),
            { timeout: 8000 }
          )
        );
      } else if (key === "notifications") {
        const r = await Notification.requestPermission();
        result = r === "granted" ? "granted" : "denied";
      }
    } catch {
      result = "denied";
    }
    setStatus((s) => ({ ...s, [key]: result }));
    return result;
  }, []);

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onComplete();
  }

  async function continueAll() {
    setRequesting(true);
    for (const p of PERMISSIONS) {
      if (status[p.key] !== "granted") await request(p.key);
    }
    setRequesting(false);
    finish();
  }

  return (
    <div className="fixed inset-0 z-50 bg-catdex-cream overflow-y-auto">
      <div className="min-h-full flex flex-col items-center px-6 py-10 sm:max-w-lg sm:mx-auto">
        {/* Hero: logo with floating feature icons */}
        <div className="relative mt-4 mb-7">
          <Logo size={104} />
          <span className="absolute -top-2 -right-9 w-9 h-9 rounded-full bg-catdex-surface shadow-soft flex items-center justify-center animate-float">
            <Camera className="h-4 w-4 text-catdex-orange" />
          </span>
          <span
            className="absolute top-9 -left-11 w-9 h-9 rounded-full bg-catdex-surface shadow-soft flex items-center justify-center animate-float"
            style={{ animationDelay: "0.6s" }}
          >
            <MapPin className="h-4 w-4 text-catdex-orange" />
          </span>
          <span
            className="absolute -bottom-1 -right-11 w-9 h-9 rounded-full bg-catdex-surface shadow-soft flex items-center justify-center animate-float"
            style={{ animationDelay: "1.2s" }}
          >
            <Bell className="h-4 w-4 text-catdex-orange" />
          </span>
        </div>

        <h1 className="text-[1.375rem] font-bold text-center leading-snug mb-2">
          Para capturar gatos,
          <br />
          necesitamos tu permiso
        </h1>
        <p className="text-sm text-catdex-text-muted text-center max-w-xs leading-relaxed mb-7">
          CatDex necesita acceder a algunas funciones de tu dispositivo para funcionar correctamente.
        </p>

        {/* Permission cards */}
        <div className="w-full space-y-3 mb-8">
          {PERMISSIONS.map((p) => {
            const st = status[p.key];
            return (
              <button
                key={p.key}
                onClick={() => request(p.key)}
                className="w-full card p-4 flex items-center gap-4 text-left transition-transform active:scale-[0.99]"
              >
                <span className="w-10 h-10 rounded-xl bg-catdex-orange/10 flex items-center justify-center text-catdex-orange shrink-0">
                  {p.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.9375rem] font-semibold">{p.title}</span>
                  <span className="block text-[0.8125rem] text-catdex-text-muted leading-snug">
                    {p.description}
                  </span>
                </span>
                <span
                  className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    st === "granted"
                      ? "bg-catdex-green-soft text-white"
                      : st === "denied"
                        ? "bg-catdex-red/15 text-catdex-red"
                        : "bg-catdex-input-bg text-catdex-gray-light"
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-full mt-auto space-y-3 text-center">
          <button onClick={continueAll} disabled={requesting} className="btn-primary w-full">
            {requesting ? "Solicitando permisos…" : "Continuar"}
          </button>
          <button onClick={finish} className="btn-ghost w-full">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

/** Check if onboarding is done (for parent components) */
export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}
