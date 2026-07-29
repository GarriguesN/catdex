"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Share,
  MoreHorizontal,
  Pencil,
  Heart,
  Calendar,
  MapPin,
  Map as MapIcon,
  Share2,
  Trash2,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Cloud,
  Check,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { getPocketBase } from "@/lib/pocketbase";
import { isFavorite, toggleFavorite, onFavoritesChange } from "@/lib/favorites";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Sheet";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-36 w-full rounded-2xl" />,
});

interface Cat {
  id: string;
  name: string;
  notes?: string;
  manuallyNamed?: boolean;
  photoCount?: number;
  created?: string;
  discoveredBy?: string;
}

interface Photo {
  id: string;
  photo?: string;
  thumb?: string;
  lat?: number;
  lng?: number;
  created?: string;
}

function CatDetailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [cat, setCat] = useState<Cat | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fav, setFav] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [savedSize, setSavedSize] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [weather, setWeather] = useState<{ temp: number; label: string } | null>(null);
  const pagerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadCat(id);
      setFav(isFavorite(id));
      return onFavoritesChange(() => setFav(isFavorite(id)));
    }
  }, [id]);

  async function loadCat(catId: string) {
    try {
      const pb = getPocketBase();
      const data = (await pb.collection("cats").getOne(catId)) as any;
      setCat(data);
      setNameInput(data.name || "");
      setNotesInput(data.notes || "");
      const photosResult = await pb.collection("photos").getFullList({
        filter: `cat="${catId}"`,
        sort: "-created",
      });
      setPhotos(photosResult as unknown as Photo[]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const mainPhoto = photos[0];

  // Location name + weather at capture (best-effort, hidden on failure)
  useEffect(() => {
    const p = photos.find((ph) => ph.lat && ph.lng);
    if (!p) return;

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lng}&format=json&zoom=10&accept-language=es`)
      .then((r) => r.json())
      .then((d) => {
        const a = d.address || {};
        const city = a.city || a.town || a.village || a.municipality;
        const country = a.country;
        if (city || country) setPlace([city, country].filter(Boolean).join(", "));
      })
      .catch(() => {});

    const date = (p.created || "").slice(0, 10);
    if (date) {
      fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lng}&start_date=${date}&end_date=${date}&hourly=temperature_2m,cloud_cover`
      )
        .then((r) => r.json())
        .then((d) => {
          const hour = new Date(p.created!).getHours();
          const temp = d?.hourly?.temperature_2m?.[hour];
          const clouds = d?.hourly?.cloud_cover?.[hour];
          if (typeof temp === "number") {
            const label =
              clouds == null ? "" : clouds < 25 ? "Despejado" : clouds < 70 ? "Parcialmente nublado" : "Nublado";
            setWeather({ temp: Math.round(temp), label });
          }
        })
        .catch(() => {});
    }
  }, [photos]);

  // Saved dimensions from the hero image
  function onHeroLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth) setSavedSize(`${img.naturalWidth} × ${img.naturalHeight}`);
  }

  function onPagerScroll() {
    const el = pagerRef.current;
    if (!el) return;
    setPhotoIndex(Math.round(el.scrollLeft / el.clientWidth));
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

  async function share() {
    if (!cat) return;
    const url = photoUrl(mainPhoto);
    try {
      await navigator.share?.({ title: cat.name, text: `Mira este gato de mi CatDex: ${cat.name}`, url: url || window.location.href });
    } catch {
      /* cancelled */
    }
  }

  async function deleteCat() {
    if (!cat) return;
    const pb = getPocketBase();
    const allPhotos = await pb.collection("photos").getFullList({ filter: `cat="${cat.id}"` });
    for (const p of allPhotos) await pb.collection("photos").delete(p.id);
    await pb.collection("cats").delete(cat.id);
    router.push("/");
  }

  function photoUrl(p?: Photo, thumb = false): string | null {
    if (!p?.photo) return null;
    const pb = getPocketBase();
    return `${pb.baseUrl}/api/files/photos/${p.id}/${p.photo}${thumb ? "?thumb=600x600" : ""}`;
  }

  if (loading) {
    return (
      <div className="pt-3 space-y-4 -mx-4">
        <div className="skeleton h-[50dvh] w-full rounded-none" />
        <div className="px-4 space-y-3">
          <div className="skeleton h-9 w-48" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!cat) {
    return (
      <div className="empty-state">
        <p className="text-4xl mb-4">😿</p>
        <p className="font-semibold text-catdex-text">Gato no encontrado</p>
        <Link href="/" className="btn-primary mt-5">
          Volver
        </Link>
      </div>
    );
  }

  const pb = getPocketBase();
  const userId = pb.authStore.record?.id;
  const isOwner = cat.discoveredBy === userId;
  const hasLocation = photos.some((p) => p.lat && p.lng);
  const capturedAt = mainPhoto?.created ? new Date(mainPhoto.created) : cat.created ? new Date(cat.created) : null;

  const dateLabel = capturedAt?.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = capturedAt?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const hour = capturedAt?.getHours() ?? 12;
  const daypart =
    hour < 7 ? { label: "Noche", icon: Moon } :
    hour < 10 ? { label: "Amanecer", icon: Sunrise } :
    hour < 19 ? { label: "Día", icon: Sun } :
    hour < 22 ? { label: "Atardecer", icon: Sunset } :
    { label: "Noche", icon: Moon };
  const DaypartIcon = daypart.icon;

  return (
    <div className="-mx-4 pb-4">
      {/* ── Hero: photo pager with overlay controls ── */}
      <div className="relative">
        <div
          ref={pagerRef}
          onScroll={onPagerScroll}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-[52dvh] bg-catdex-input-bg"
        >
          {photos.length > 0 ? (
            photos.map((p, i) => {
              const url = photoUrl(p);
              return (
                <div key={p.id} className="w-full h-full shrink-0 snap-center">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`${cat.name} ${i + 1}`}
                      className="w-full h-full object-cover"
                      onLoad={i === 0 ? onHeroLoad : undefined}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🐱</div>
          )}
        </div>

        {/* Overlay top bar */}
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-between px-4"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => router.back()}
            aria-label="Volver"
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={share}
              aria-label="Compartir"
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
            >
              <Share className="h-5 w-5" />
            </button>
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                aria-label="Más opciones"
                className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Pager badge */}
        {photos.length > 1 && (
          <span className="absolute bottom-4 right-4 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-semibold">
            {photoIndex + 1}/{photos.length}
          </span>
        )}
      </div>

      {/* ── Content card ── */}
      <div className="relative -mt-6 bg-catdex-cream rounded-t-3xl px-4 pt-6 space-y-4">
        {/* Name + favorite */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input
                  className="field flex-1 text-lg font-bold"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                />
                <button onClick={saveName} aria-label="Guardar nombre" className="w-10 h-10 rounded-full bg-catdex-orange text-white flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <h1 className="text-[1.75rem] font-bold tracking-tight truncate">{cat.name || "Sin nombre"}</h1>
                {isOwner && (
                  <button
                    onClick={() => setEditingName(true)}
                    aria-label="Editar nombre"
                    className="p-1.5 text-catdex-text-muted"
                  >
                    <Pencil className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>
            )}

            {/* Date + location rows */}
            <div className="mt-2.5 space-y-1.5">
              {capturedAt && (
                <p className="flex items-center gap-2 text-sm text-catdex-text-secondary">
                  <Calendar className="h-4 w-4 text-catdex-text-muted" />
                  {dateLabel} · {timeLabel}
                </p>
              )}
              {(place || hasLocation) && (
                <p className="flex items-center gap-2 text-sm text-catdex-text-secondary">
                  <MapPin className="h-4 w-4 text-catdex-text-muted" />
                  {place || "Ubicación guardada"}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => id && toggleFavorite(id)}
            aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
            className="w-12 h-12 rounded-2xl bg-catdex-orange/10 flex items-center justify-center shrink-0 transition-transform active:scale-90"
          >
            <Heart className={clsx("h-5.5 w-5.5 text-catdex-orange", fav && "fill-catdex-orange")} />
          </button>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-4 gap-2.5">
          <ActionButton icon={<MapIcon className="h-5 w-5" />} label="Ver en mapa" onClick={() => router.push(`/map?catId=${cat.id}`)} />
          <ActionButton icon={<Share2 className="h-5 w-5" />} label="Compartir" onClick={share} />
          <ActionButton
            icon={<Pencil className="h-5 w-5" />}
            label="Editar"
            onClick={() => setEditingName(true)}
            disabled={!isOwner}
          />
          <ActionButton
            icon={<Trash2 className="h-5 w-5" />}
            label="Eliminar"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!isOwner}
            destructive
          />
        </div>

        {/* Notes */}
        {isOwner && (
          <Card className="bg-catdex-orange/[0.06]">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[0.9375rem] font-semibold">Notas</h3>
              <button onClick={() => setEditingNotes(true)} aria-label="Editar notas" className="p-1 text-catdex-text-muted">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            {editingNotes ? (
              <div className="space-y-2.5">
                <textarea
                  className="field min-h-[90px] resize-y"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={saveNotes} className="btn-primary text-sm py-2.5 px-5">
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setNotesInput(cat.notes || "");
                      setEditingNotes(false);
                    }}
                    className="btn-ghost"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-catdex-text-secondary leading-relaxed cursor-pointer"
                onClick={() => setEditingNotes(true)}
              >
                {cat.notes || "Añade notas sobre este gato…"}
              </p>
            )}
          </Card>
        )}

        {/* Technical details */}
        <Card>
          <h3 className="text-[0.9375rem] font-semibold mb-3">Detalles técnicos</h3>
          <div className="space-y-2.5">
            <DetailRow label="¿Es un gato?" value="Sí" valueClass="text-catdex-green font-semibold" />
            <DetailRow label="Modelo IA" value="MobileNetV3" />
            {savedSize && <DetailRow label="Tamaño guardado" value={savedSize} />}
            <DetailRow label="Fotos" value={`${photos.length}`} />
            {mainPhoto?.photo && <DetailRow label="Archivo" value={mainPhoto.photo} mono />}
          </div>
        </Card>

        {/* Location */}
        {hasLocation && (
          <Card>
            <Link href={`/map?catId=${cat.id}`} className="flex items-center justify-between mb-3">
              <h3 className="text-[0.9375rem] font-semibold">Ubicación</h3>
              <ChevronRight className="h-4.5 w-4.5 text-catdex-gray-light" />
            </Link>
            <MiniMap catId={cat.id} />
          </Card>
        )}

        {/* Captured at */}
        {capturedAt && (
          <Card>
            <h3 className="text-[0.9375rem] font-semibold mb-3.5">Capturado en</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <DaypartIcon className="h-6 w-6 text-catdex-orange" />
                <p className="text-sm font-semibold leading-none">{timeLabel}</p>
                <p className="text-xs text-catdex-text-muted">{daypart.label}</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Cloud className="h-6 w-6 text-catdex-orange" />
                <p className="text-sm font-semibold leading-none">
                  {weather ? `${weather.temp}°C` : "—"}
                </p>
                <p className="text-xs text-catdex-text-muted leading-tight">
                  {weather?.label || "Sin datos"}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <MapPin className="h-6 w-6 text-catdex-orange" />
                <p className="text-xs text-catdex-text-muted leading-tight mt-1">
                  {place || (hasLocation ? "Ubicación guardada" : "Sin ubicación")}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={`¿Eliminar a ${cat.name || "este gato"}?`}
        message="Se borrarán el gato y todas sus fotos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={deleteCat}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "card flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 transition-transform active:scale-[0.96] disabled:opacity-40",
        destructive ? "text-catdex-red" : "text-catdex-text"
      )}
    >
      {icon}
      <span className={clsx("text-[0.6875rem] font-medium leading-none", destructive ? "text-catdex-red" : "text-catdex-text-secondary")}>
        {label}
      </span>
    </button>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
  mono,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-catdex-text-muted">{label}</span>
      <span className={clsx("text-sm text-right truncate", mono && "font-mono text-xs", valueClass)}>{value}</span>
    </div>
  );
}

export default function CatDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="pt-3 -mx-4">
          <div className="skeleton h-[50dvh] w-full rounded-none" />
        </div>
      }
    >
      <CatDetailInner />
    </Suspense>
  );
}
