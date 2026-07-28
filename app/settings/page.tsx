"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import {
  ArrowLeft,
  MapPin,
  Vibrate,
  Volume2,
  Download,
  Upload,
  Trash2,
  Info,
  Shield,
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [storageInfo, setStorageInfo] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadSettings();
    estimateStorage();
  }, []);

  async function loadSettings() {
    try {
      const gps = await db.settings.get("gps");
      if (gps) setGpsEnabled(!!gps.value);
      const vib = await db.settings.get("vibration");
      if (vib) setVibrationEnabled(!!vib.value);
      const snd = await db.settings.get("sound");
      if (snd) setSoundEnabled(!!snd.value);
    } catch {
      // Defaults are fine
    }
  }

  async function toggleGPS() {
    const newVal = !gpsEnabled;
    setGpsEnabled(newVal);
    await db.settings.put({ key: "gps", value: newVal });
  }

  async function toggleVibration() {
    const newVal = !vibrationEnabled;
    setVibrationEnabled(newVal);
    await db.settings.put({ key: "vibration", value: newVal });
  }

  async function toggleSound() {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    await db.settings.put({ key: "sound", value: newVal });
  }

  async function estimateStorage() {
    try {
      const estimate = await navigator.storage?.estimate();
      if (estimate) {
        const used = ((estimate.usage || 0) / 1024 / 1024).toFixed(1);
        const quota = ((estimate.quota || 0) / 1024 / 1024).toFixed(1);
        setStorageInfo(`${used} MB / ${quota} MB`);
      }
    } catch {
      setStorageInfo("No disponible");
    }
  }

  async function exportAll() {
    try {
      const cats = await db.cats.toArray();
      const photos = await db.photos.toArray();
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        cats: cats.map(({ ...rest }) => rest),
        photoCount: photos.length,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catdex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al exportar: " + (err as Error).message);
    }
  }

  async function importBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.cats || !Array.isArray(data.cats)) {
          alert("Formato de backup no válido");
          return;
        }
        // Restore cats (photos are not included in simple export)
        for (const cat of data.cats) {
          const exists = await db.cats.get(cat.id);
          if (!exists) {
            await db.cats.put(cat);
          }
        }
        alert(`Importado: ${data.cats.length} gatos restaurados.`);
        window.location.reload();
      } catch (err) {
        alert("Error al importar: " + (err as Error).message);
      }
    };
    input.click();
  }

  async function deleteAll() {
    await db.cats.clear();
    await db.photos.clear();
    await db.achievements.clear();
    window.location.href = "/";
  }

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Ajustes</h1>
      </div>

      {/* Permissions */}
      <div className="card-pokedex divide-y divide-border">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-pokedex-red" />
            <div>
              <p className="text-sm font-medium">GPS</p>
              <p className="text-[10px] text-muted-foreground">
                Guardar ubicación de las fotos
              </p>
            </div>
          </div>
          <button
            onClick={toggleGPS}
            className={`w-11 h-6 rounded-full transition-colors ${
              gpsEnabled ? "bg-pokedex-red" : "bg-pokedex-gray-mid"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                gpsEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>

        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vibrate className="h-4 w-4 text-pokedex-red" />
            <div>
              <p className="text-sm font-medium">Vibración</p>
              <p className="text-[10px] text-muted-foreground">
                Feedback háptico al capturar
              </p>
            </div>
          </div>
          <button
            onClick={toggleVibration}
            className={`w-11 h-6 rounded-full transition-colors ${
              vibrationEnabled ? "bg-pokedex-red" : "bg-pokedex-gray-mid"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                vibrationEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>

        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-pokedex-red" />
            <div>
              <p className="text-sm font-medium">Sonidos</p>
              <p className="text-[10px] text-muted-foreground">
                Efectos al atrapar gatos
              </p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            className={`w-11 h-6 rounded-full transition-colors ${
              soundEnabled ? "bg-pokedex-red" : "bg-pokedex-gray-mid"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                soundEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Data */}
      <div className="card-pokedex divide-y divide-border">
        <button
          onClick={exportAll}
          className="w-full p-3 flex items-center gap-2 text-left hover:bg-pokedex-gray-mid/50 transition-colors"
        >
          <Download className="h-4 w-4 text-pokedex-green" />
          <span className="text-sm">Exportar colección (JSON)</span>
        </button>
        <button
          onClick={importBackup}
          className="w-full p-3 flex items-center gap-2 text-left hover:bg-pokedex-gray-mid/50 transition-colors"
        >
          <Upload className="h-4 w-4 text-pokedex-blue" />
          <span className="text-sm">Importar backup</span>
        </button>
      </div>

      {/* Danger zone */}
      <div className="card-pokedex divide-y divide-border border-red-900">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full p-3 flex items-center gap-2 text-left hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">Borrar toda la colección</span>
        </button>
      </div>

      {/* About */}
      <div className="card-pokedex p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">CatDex v0.1.0</p>
        </div>
        <p className="text-xs text-muted-foreground">
          PWA mobile-first · 100% offline · Fotos en tu dispositivo
        </p>
        <p className="text-xs text-muted-foreground">
          Almacenamiento: {storageInfo}
        </p>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-pokedex-gray-dark w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 animate-pop-in">
            <h3 className="text-lg font-bold text-red-400 mb-2">
              ¿Borrar todo?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Esta acción no se puede deshacer. Perderás todos los gatos, fotos y badges.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-pokedex-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={deleteAll}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
              >
                Borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
