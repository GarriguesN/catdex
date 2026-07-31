"use client";

import { useEffect, useState } from "react";
import { User, Bell, Volume2, Lock, FileUp, Info, Bug } from "lucide-react";
import { TopBar } from "@/components/ui/TopBar";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsRow";
import { areSoundsEnabled } from "@/lib/sound-prefs";
import { CHANGELOG } from "@/lib/changelog";

const APP_VERSION = `v${CHANGELOG[0].version}`;

export default function SettingsPage() {
  const [soundsOn, setSoundsOn] = useState(true);

  useEffect(() => {
    setSoundsOn(areSoundsEnabled());
  }, []);

  return (
    <div className="space-y-5">
      <TopBar title="Ajustes" />

      <SettingsGroup>
        <SettingsRow icon={<User className="h-5 w-5" />} label="Cuenta" href="/settings/account" />
        <SettingsRow icon={<Bell className="h-5 w-5" />} label="Notificaciones" href="/settings/notifications" />
        <SettingsRow
          icon={<Volume2 className="h-5 w-5" />}
          label="Sonidos"
          value={soundsOn ? "Activados" : "Silenciados"}
          href="/settings/sounds"
        />
        <SettingsRow icon={<Lock className="h-5 w-5" />} label="Privacidad" href="/settings/privacy" />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon={<FileUp className="h-5 w-5" />} label="Exportar datos" href="/settings/export" />
        <SettingsRow
          icon={<Info className="h-5 w-5" />}
          label="Acerca de CatDex"
          value={APP_VERSION}
          href="/settings/about"
        />
        <SettingsRow icon={<Bug className="h-5 w-5" />} label="Modo debug" href="/settings/debug" />
      </SettingsGroup>
    </div>
  );
}
