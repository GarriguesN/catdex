"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Download, Upload, Trash2, Info } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [storageInfo, setStorageInfo] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    estimateStorage();
  }, []);

  async function estimateStorage() {
    try {
      const estimate = await navigator.storage?.estimate();
      if (estimate) {
        const used = ((estimate.usage || 0) / 1024 / 1024).toFixed(1);
        setStorageInfo(`${used} MB usado`);
      }
    } catch {
      setStorageInfo("No disponible");
    }
  }

  async function deleteAll() {
    try {
      const cats: any[] = await fetch("/api/cats").then(r => r.json());
      for (const cat of cats) {
        await fetch(`/api/cats/${cat.id}`, { method: "DELETE" });
      }
      window.location.href = "/";
    } catch (err) {
      alert("Error al borrar: " + (err as Error).message);
    }
  }

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Ajustes</h1>
      </div>

      <div className="card-pokedex p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-catdex-text-muted" />
          <p className="text-sm">{session?.user?.email || "Sin sesión"}</p>
        </div>
        <p className="text-xs text-catdex-text-muted">
          {storageInfo}
        </p>
      </div>

      <div className="card-pokedex divide-y divide-catdex-border border-red-900">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full p-3 flex items-center gap-2 text-left hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">Borrar toda la colección</span>
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 animate-pop-in border-2 border-catdex-border">
            <h3 className="text-lg font-bold text-red-400 mb-2">¿Borrar todo?</h3>
            <p className="text-sm text-catdex-text-muted mb-6">
              Esta acción no se puede deshacer. Perderás todos los gatos y fotos.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-pokedex-secondary flex-1">
                Cancelar
              </button>
              <button onClick={deleteAll} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-semibold text-sm">
                Borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
