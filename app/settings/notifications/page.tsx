"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { TopBar } from "@/components/ui/TopBar";
import { Toggle } from "@/components/ui/Toggle";
import {
  getPushAvailability,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  type PushAvailability,
} from "@/lib/push";

const PREFS_KEY = "catdex_notification_prefs";

interface Prefs {
  reminders: boolean;
  achievements: boolean;
  activity: boolean;
}

const DEFAULTS: Prefs = { reminders: true, achievements: true, activity: false };

const ROWS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "reminders", label: "Recordatorios", description: "Un aviso cuando tu racha esté a punto de romperse" },
  { key: "achievements", label: "Logros", description: "Cuando desbloqueas un logro nuevo" },
  { key: "activity", label: "Actividad", description: "Solicitudes de amistad y capturas que te comparten" },
];

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) setPrefs({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {
      /* defaults */
    }

    const avail = getPushAvailability();
    console.log("[push] availability:", avail);
    setAvailability(avail);
    getExistingSubscription()
      .then((sub) => {
        console.log("[push] existing subscription:", sub ? sub.endpoint : null);
        setSubscribed(!!sub);
      })
      .catch((err) => console.error("[push] getExistingSubscription failed:", err));
  }, []);

  function update(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  async function togglePush(enable: boolean) {
    console.log("[push] toggle:", enable);
    setWorking(true);
    setError("");
    try {
      if (enable) await subscribeToPush();
      else await unsubscribeFromPush();
      setSubscribed(enable);
    } catch (err) {
      console.error("[push] toggle failed:", err);
      setError((err as Error).message || "No se ha podido cambiar el estado de las notificaciones.");
    }
    setWorking(false);
  }

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Notificaciones" />

      {/* Push status — device-aware: iOS needs the PWA installed first */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-catdex-orange/10 flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5 text-catdex-orange" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[0.9375rem] font-semibold">Notificaciones push</p>
            <p className="text-[0.8125rem] text-catdex-text-muted leading-snug">
              {availability === "unsupported"
                ? "Tu navegador no las soporta."
                : availability === "ios-needs-install"
                  ? "Necesitas instalar CatDex en tu pantalla de inicio primero."
                  : subscribed
                    ? "Activadas en este dispositivo"
                    : "Recibe avisos aunque tengas la app cerrada"}
            </p>
          </div>
          {availability === "ready" && (
            <Toggle
              checked={subscribed}
              onChange={togglePush}
              disabled={working}
              label="Notificaciones push"
            />
          )}
        </div>

        {availability === "ios-needs-install" && (
          <div className="flex items-start gap-2.5 mt-3.5 pt-3.5 border-t border-catdex-hairline">
            <Smartphone className="h-4 w-4 text-catdex-text-muted shrink-0 mt-0.5" />
            <p className="text-[0.8125rem] text-catdex-text-muted leading-relaxed">
              En iPhone/iPad: toca <span className="font-semibold">Compartir</span> en Safari y luego{" "}
              <span className="font-semibold">Añadir a pantalla de inicio</span>. Abre CatDex desde ese
              icono para poder activarlas.
            </p>
          </div>
        )}

        {error && <p className="text-[0.8125rem] text-catdex-red mt-2">{error}</p>}
      </div>

      <div className="card overflow-hidden divide-y divide-catdex-hairline">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-[0.9375rem] font-medium">{row.label}</p>
              <p className="text-[0.8125rem] text-catdex-text-muted leading-snug">{row.description}</p>
            </div>
            <Toggle checked={prefs[row.key]} onChange={(v) => update(row.key, v)} label={row.label} />
          </div>
        ))}
      </div>

      <p className="text-xs text-catdex-gray-light px-2 leading-relaxed">
        Las notificaciones dependen del permiso del sistema. Puedes cambiarlo en los ajustes de tu
        dispositivo.
      </p>
    </div>
  );
}
