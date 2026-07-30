"use client";

import { TopBar } from "@/components/ui/TopBar";
import { Logo } from "@/components/ui/Logo";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsRow";
import { Card, CardTitle } from "@/components/ui/Card";
import { CHANGELOG } from "@/lib/changelog";

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
        <SettingsRow label="Versión" value={CHANGELOG[0].version} chevron={false} />
        <SettingsRow label="Motor de detección" value="coco-ssd" chevron={false} />
        <SettingsRow label="Hecho con" value="🐾 en Valencia" chevron={false} />
      </SettingsGroup>

      <div>
        <CardTitle className="mb-2 px-1">Notas de la versión</CardTitle>
        <div className="space-y-3">
          {CHANGELOG.map((entry) => (
            <Card key={entry.version}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-semibold text-catdex-text">v{entry.version}</span>
                <span className="text-xs text-catdex-text-muted">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-[0.8125rem] text-catdex-text-secondary leading-relaxed flex gap-2">
                    <span className="text-catdex-orange shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
