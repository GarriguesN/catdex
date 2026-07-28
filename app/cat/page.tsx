"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Camera, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getPocketBase } from "@/lib/pocketbase";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-32 w-full rounded-lg" />,
});

interface Cat { id: string; name: string; notes?: string; manuallyNamed?: boolean; photoCount?: number; created?: string; }
interface Photo { id: string; cat?: string; taken_at?: number; lat?: number; lng?: number; photo?: string; }

function CatDetailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [cat, setCat] = useState<Cat | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");

  useEffect(() => { if (id) loadCat(id); }, [id]);

  async function loadCat(catId: string) {
    try {
      const pb = getPocketBase();
      const data = await pb.collection("cats").getOne(catId) as any;
      setCat(data);
      setNameInput(data.name || "");
      setNotesInput(data.notes || "");
      const photosResult = await pb.collection("photos").getFullList({ filter: `cat="${catId}"` });
      setPhotos(photosResult.map((p: any) => p));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function saveName() {
    if (!cat || !nameInput.trim()) return;
    const pb = getPocketBase();
    await pb.collection("cats").update(cat.id, { name: nameInput.trim(), manuallyNamed: true });
    setCat({ ...cat, name: nameInput.trim(), manuallyNamed: true });
    setEditingName(false);
  }

  async function saveNotes() {
    if (!cat) return;
    const pb = getPocketBase();
    await pb.collection("cats").update(cat.id, { notes: notesInput });
    setCat({ ...cat, notes: notesInput });
    setEditingNotes(false);
  }

  async function deleteCat() {
    if (!cat) return;
    if (!window.confirm(`¿Borrar a ${cat.name} y todas sus fotos?`)) return;
    const pb = getPocketBase();
    // Delete photos first
    const allPhotos = await pb.collection("photos").getFullList({ filter: `cat="${cat.id}"` });
    for (const p of allPhotos) await pb.collection("photos").delete(p.id);
    await pb.collection("cats").delete(cat.id);
    router.push("/");
  }

  if (loading) return <div className="py-8 space-y-4"><div className="skeleton h-64 w-full rounded-xl" /></div>;
  if (!cat) return <div className="empty-state"><p className="text-4xl mb-4">😿</p><p>Gato no encontrado</p><Link href="/" className="btn-pokedex mt-4 inline-block">Volver</Link></div>;

  const hasLocation = photos.some(p => p.lat && p.lng);

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          {editingName ? (
            <div className="flex gap-2">
              <input className="input-pokedex flex-1" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()} autoFocus />
              <button onClick={saveName} className="btn-pokedex text-xs">OK</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{cat.name}</h1>
              {!cat.manuallyNamed && (
                <button onClick={() => setEditingName(true)} className="p-1 rounded hover:bg-catdex-input-bg"><Edit3 className="h-3.5 w-3.5 text-catdex-text-muted" /></button>
              )}
            </div>
          )}
          <p className="text-xs text-catdex-text-muted">{cat.photoCount || 0} foto{(cat.photoCount || 0) !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {photos.length > 0 && photos[0].photo && (
        <div className="rounded-xl overflow-hidden border-2 border-catdex-border">
          <img src={`${getPocketBase().baseUrl}/api/files/photos/${photos[0].id}/${photos[0].photo}`} alt={cat.name} className="w-full aspect-video object-cover" />
        </div>
      )}

      {photos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-catdex-text-muted mb-2 flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" />Fotos ({photos.length})</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3">
            {photos.map(p => (
              <div key={p.id} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 border-catdex-border">
                {p.photo && <img src={`${getPocketBase().baseUrl}/api/files/photos/${p.id}/${p.photo}?thumb=100x100`} alt="" className="w-full h-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasLocation && (
        <div className="card-pokedex p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">{photos.filter(p => p.lat).length} ubicaciones</span>
            <Link href={`/map?catId=${cat.id}`} className="ml-auto text-xs text-catdex-orange hover:underline">Ver mapa</Link>
          </div>
          <MiniMap catId={cat.id} />
        </div>
      )}

      <div className="card-pokedex p-3">
        <h3 className="text-xs font-semibold text-catdex-text-muted mb-1.5">Notas</h3>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea className="input-pokedex min-h-[80px] resize-y" value={notesInput} onChange={e => setNotesInput(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={saveNotes} className="btn-pokedex text-xs">Guardar</button>
              <button onClick={() => { setNotesInput(cat.notes || ""); setEditingNotes(false); }} className="btn-pokedex-secondary text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-catdex-text-muted cursor-pointer" onClick={() => setEditingNotes(true)}>{cat.notes || "Añade notas..."}</p>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={deleteCat} className="btn-pokedex-secondary text-xs flex items-center gap-1.5 text-red-400">
          <Trash2 className="h-3.5 w-3.5" />Borrar
        </button>
      </div>
    </div>
  );
}

export default function CatDetailPage() {
  return <Suspense fallback={<div className="py-8 space-y-4"><div className="skeleton h-64 w-full rounded-xl" /></div>}><CatDetailInner /></Suspense>;
}
