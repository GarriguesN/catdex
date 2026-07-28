"use client";

import { Camera, MapPin, Bell, Mic, ShieldCheck } from "lucide-react";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsRow";

export default function PrivacyPage() {
  function reopenPermissions() {
    localStorage.removeItem("catdex_onboarding_done");
    window.location.href = "/";
  }

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Privacidad" />

      <Card className="flex items-start gap-4">
        <span className="w-10 h-10 rounded-xl bg-catdex-orange/10 flex items-center justify-center text-catdex-orange shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <p className="text-[0.8125rem] text-catdex-text-muted leading-relaxed">
          Tus fotos y ubicaciones se guardan en tu cuenta y solo se comparten con la colonia de
          CatDex. Nunca vendemos tus datos.
        </p>
      </Card>

      <SettingsGroup>
        <SettingsRow icon={<Camera className="h-5 w-5" />} label="Cámara" value="Fotos de gatos" chevron={false} onClick={undefined} />
        <SettingsRow icon={<MapPin className="h-5 w-5" />} label="Ubicación" value="Mapa de capturas" chevron={false} onClick={undefined} />
        <SettingsRow icon={<Bell className="h-5 w-5" />} label="Notificaciones" value="Recordatorios" chevron={false} onClick={undefined} />
        <SettingsRow icon={<Mic className="h-5 w-5" />} label="Micrófono" value="Sonidos" chevron={false} onClick={undefined} />
      </SettingsGroup>

      <button onClick={reopenPermissions} className="btn-secondary w-full">
        Revisar permisos
      </button>
    </div>
  );
}
