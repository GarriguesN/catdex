"use client";

import { TopBar } from "@/components/ui/TopBar";
import { Logo } from "@/components/ui/Logo";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsRow";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <TopBar back backHref="/settings" title="Acerca de CatDex" />

      <div className="pt-4">
        <Logo size={96} wordmark />
      </div>

      <p className="text-sm text-catdex-text-muted text-center max-w-xs mx-auto leading-relaxed">
        Captura gatos reales con tu cámara, colecciónalos como en una Pokédex y compite con tus
        amigos por descubrir la colonia entera.
      </p>

      <SettingsGroup>
        <SettingsRow label="Versión" value="1.0.0" chevron={false} />
        <SettingsRow label="Motor de detección" value="MobileNetV3" chevron={false} />
        <SettingsRow label="Hecho con" value="🐾 en Valencia" chevron={false} />
      </SettingsGroup>
    </div>
  );
}
