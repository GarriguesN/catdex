"use client";

import { useEffect, useState } from "react";
import { db, type Photo, type Cat } from "@/lib/db";
import { CatAvatar } from "@/components/CatAvatar";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function MapPageInner() {
  const searchParams = useSearchParams();
  const catId = searchParams.get("catId");
  const [photos, setPhotos] = useState<(Photo & { catName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, [catId]);

  async function loadPhotos() {
    let allPhotos: Photo[];
    if (catId) {
      allPhotos = await db.photos.where("catId").equals(catId).toArray();
    } else {
      allPhotos = await db.photos.toArray();
    }

    // Filter those with location
    const withLoc = allPhotos.filter((p) => p.lat !== undefined && p.lng !== undefined);

    // Enrich with cat names
    const enriched = await Promise.all(
      withLoc.map(async (p) => {
        const cat = await db.cats.get(p.catId);
        return { ...p, catName: cat?.name };
      })
    );

    enriched.sort((a, b) => b.takenAt - a.takenAt);
    setPhotos(enriched);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="py-8 space-y-4">
        <div className="skeleton h-48 w-full rounded-xl" />
        <div className="skeleton h-6 w-32" />
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Mapa</h1>
          {catId && photos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Avistamientos de {photos[0].catName}
            </p>
          )}
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {photos.length} punto{photos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Sin ubicaciones</p>
          <p className="text-sm text-muted-foreground">
            Activa el GPS al hacer fotos para verlas aquí
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {photos.map((photo) => (
            <Link
              key={photo.id}
              href={`/cat?id=${photo.catId}`}
              className="card-pokedex p-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                <CatAvatar blobId={photo.id} size="sm" className="w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {photo.catName || "Gato"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {photo.lat?.toFixed(4)}, {photo.lng?.toFixed(4)}
                </p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(photo.takenAt).toLocaleDateString("es-ES")}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Note: Full Leaflet map with markers added in Fase 3 */}
      <p className="text-xs text-center text-muted-foreground pt-4">
        🌍 Mapa interactivo próximamente — de momento puedes ver todos los puntos GPS
      </p>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="skeleton h-48 w-full rounded-xl mt-4" />}>
      <MapPageInner />
    </Suspense>
  );
}
