"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { Toggle } from "@/components/ui/Toggle";

const PREFS_KEY = "catdex_notification_prefs";

interface Prefs {
  reminders: boolean;
  achievements: boolean;
  activity: boolean;
}

const DEFAULTS: Prefs = { reminders: true, achievements: true, activity: false };

const ROWS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "reminders", label: "Recordatorios", description: "Un aviso diario para salir a capturar" },
  { key: "achievements", label: "Logros", description: "Cuando desbloqueas un logro nuevo" },
  { key: "activity", label: "Actividad", description: "Cuando alguien avista uno de tus gatos" },
];

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) setPrefs({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch { /* defaults */ }
  }, []);

  function update(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    if (value && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Notificaciones" />

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
