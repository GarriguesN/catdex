"use client";

import { useState } from "react";
import { FileDown, Check } from "lucide-react";
import { getPocketBase } from "@/lib/pocketbase";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";

export default function ExportPage() {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setExporting(true);
    setError("");
    setDone(false);
    try {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;
      const [cats, photos] = await Promise.all([
        pb.collection("cats").getFullList({ filter: `discoveredBy="${userId}"` }),
        pb.collection("photos").getFullList({ filter: `user="${userId}"` }),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        user: pb.authStore.record?.email,
        cats,
        photos: photos.map((p: any) => ({
          ...p,
          photoUrl: p.photo ? `${pb.baseUrl}/api/files/photos/${p.id}/${p.photo}` : null,
        })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catdex_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "No se han podido exportar los datos");
    }
    setExporting(false);
  }

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Exportar datos" />

      <Card className="flex items-start gap-4">
        <span className="w-10 h-10 rounded-xl bg-catdex-orange/10 flex items-center justify-center text-catdex-orange shrink-0">
          <FileDown className="h-5 w-5" />
        </span>
        <p className="text-[0.8125rem] text-catdex-text-muted leading-relaxed">
          Descarga una copia de tu colección en formato JSON: tus gatos, fotos, notas y
          ubicaciones. Las fotos se incluyen como enlaces.
        </p>
      </Card>

      {error && (
        <p className="text-sm text-catdex-red text-center animate-fade-up">{error}</p>
      )}
      {done && (
        <p className="text-sm text-catdex-green text-center inline-flex items-center gap-1.5 w-full justify-center animate-fade-up">
          <Check className="h-4 w-4" /> Exportación completada
        </p>
      )}

      <button onClick={exportData} disabled={exporting} className="btn-primary w-full">
        {exporting ? "Preparando…" : "Descargar mi colección"}
      </button>
    </div>
  );
}
