"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { db, type Cat, type Photo } from "@/lib/db";
import { CatAvatar } from "@/components/CatAvatar";
import { ArrowLeft, MapPin, Camera, Edit3, Trash2, Share2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-32 w-full rounded-lg" />,
});

function CatDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [cat, setCat] = useState<Cat | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");

  useEffect(() => {
    if (!id) return;
    loadCat(id);
  }, [id]);

  async function loadCat(catId: string) {
    const c = await db.cats.get(catId);
    if (!c) {
      setLoading(false);
      return;
    }
    setCat(c);
    setNameInput(c.name);
    setNotesInput(c.notes || "");
    const ps = await db.photos.where("catId").equals(catId).toArray();
    ps.sort((a, b) => b.takenAt - a.takenAt);
    setPhotos(ps);
    setLoading(false);
  }

  async function saveName() {
    if (!cat || !nameInput.trim()) return;
    await db.cats.update(cat.id, {
      name: nameInput.trim(),
      manuallyNamed: true,
    });
    setCat({ ...cat, name: nameInput.trim(), manuallyNamed: true });
    setEditingName(false);
  }

  async function saveNotes() {
    if (!cat) return;
    await db.cats.update(cat.id, { notes: notesInput });
    setCat({ ...cat, notes: notesInput });
    setEditingNotes(false);
  }

  async function deleteCat() {
    if (!cat) return;
    const confirmed = window.confirm(`¿Borrar a ${cat.name} y todas sus fotos?`);
    if (!confirmed) return;
    await db.photos.where("catId").equals(cat.id).delete();
    await db.cats.delete(cat.id);
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="py-8 space-y-4">
        <div className="skeleton h-64 w-full rounded-xl" />
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-full" />
      </div>
    );
  }

  if (!cat) {
    return (
      <div className="empty-state">
        <p className="text-4xl mb-4">😿</p>
        <p className="text-lg font-medium">Gato no encontrado</p>
        <Link href="/" className="btn-pokedex mt-4 inline-block">
          Volver a la colección
        </Link>
      </div>
    );
  }

  const hasLocation = photos.some((p) => p.lat && p.lng);

  return (
    <div className="py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          {editingName ? (
            <div className="flex gap-2">
              <input
                className="input-pokedex flex-1"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
              />
              <button onClick={saveName} className="btn-pokedex text-xs">
                OK
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{cat.name}</h1>
              {!cat.manuallyNamed && (
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1 rounded hover:bg-pokedex-gray-mid transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Primera captura: {formatDate(cat.createdAt)}
            {" · "}
            {cat.photoCount} foto{cat.photoCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Hero photo */}
      {photos.length > 0 && (
        <CatAvatar
          blobId={photos[0].id}
          size="lg"
          className="w-full aspect-video rounded-xl"
        />
      )}

      {/* Photos gallery */}
      {photos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            Fotos ({photos.length})
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-border"
              >
                <CatAvatar blobId={photo.id} size="sm" className="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location summary + mini-map */}
      {hasLocation && (
        <div className="card-pokedex p-3 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-pokedex-red" />
            <span className="text-sm">
              {photos.filter((p) => p.lat).length} ubicacion{photos.filter((p) => p.lat).length !== 1 ? "es" : ""} registrada{photos.filter((p) => p.lat).length !== 1 ? "s" : ""}
            </span>
            <Link
              href={`/map?catId=${cat.id}`}
              className="ml-auto text-xs text-pokedex-blue hover:underline"
            >
              Ver mapa completo
            </Link>
          </div>
          {/* Mini-map */}
          <MiniMap catId={cat.id} />
        </div>
      )}

      {/* Notes */}
      <div className="card-pokedex p-3">
        <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Notas</h3>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              className="input-pokedex min-h-[80px] resize-y"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="¿Dónde le ves? ¿Es tímido? ¿Tiene dueño?..."
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={saveNotes} className="btn-pokedex text-xs">
                Guardar
              </button>
              <button
                onClick={() => {
                  setNotesInput(cat.notes || "");
                  setEditingNotes(false);
                }}
                className="btn-pokedex-secondary text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-sm text-muted-foreground cursor-pointer hover:text-pokedex-gray-light"
            onClick={() => setEditingNotes(true)}
          >
            {cat.notes || "Añade notas sobre este gato..."}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            // share logic (Fase 5)
            alert("Compartir disponible en breve");
          }}
          className="btn-pokedex-secondary text-xs flex items-center gap-1.5"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir
        </button>
        <button
          onClick={deleteCat}
          className="btn-pokedex-secondary text-xs flex items-center gap-1.5 text-red-400 border-red-900"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Borrar
        </button>
      </div>
    </div>
  );
}

export default function CatDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 space-y-4">
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-6 w-48" />
        </div>
      }
    >
      <CatDetailInner />
    </Suspense>
  );
}
