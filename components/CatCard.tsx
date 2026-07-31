"use client";

import Link from "next/link";
import { Heart, Camera } from "lucide-react";
import clsx from "clsx";

interface CatCardProps {
  id: string;
  rank?: number;
  name: string;
  thumbUrl: string | null;
  date: Date;
  favorite: boolean;
  onToggleFavorite: () => void;
  /** Shown as a small clickable pill over the photo — who discovered this
   * cat, for the "Amigos" tab of the collection (own cats don't pass this).
   * Links to their profile — kept as a sibling of the main photo Link
   * (both absolutely positioned) rather than nested inside it, since
   * nested <Link>s aren't valid. */
  discoverer?: { id: string; name: string; avatarUrl: string | null };
}

/** Photo tile for the collection grid: numbered badge, name + date, heart. */
export function CatCard({ id, rank, name, thumbUrl, date, favorite, onToggleFavorite, discoverer }: CatCardProps) {
  const dateLabel = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="animate-fade-up">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-catdex-input-bg shadow-soft">
        <Link
          href={`/cat?id=${id}`}
          className="absolute inset-0 block transition-transform active:scale-[0.97]"
        >
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt="" className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <span className="w-full h-full flex items-center justify-center">
              <Camera className="h-7 w-7 text-catdex-gray-light" />
            </span>
          )}
          {rank ? (
            <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-catdex-text text-[0.6875rem] font-bold px-2 py-0.5 rounded-full shadow-soft">
              #{rank}
            </span>
          ) : null}
        </Link>
        {discoverer && (
          <Link
            href={`/profile/${discoverer.id}`}
            className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5 bg-black/45 backdrop-blur-sm rounded-full pl-1 pr-2 py-1 active:scale-95 transition-transform"
          >
            {discoverer.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={discoverer.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-catdex-orange/60 text-white text-[0.5rem] font-bold flex items-center justify-center shrink-0">
                {(discoverer.name[0] || "?").toUpperCase()}
              </span>
            )}
            <span className="text-white text-[0.625rem] font-semibold truncate">{discoverer.name || "Sin nombre"}</span>
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-1 pt-1.5">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold truncate">{name}</p>
          <p className="text-[0.6875rem] text-catdex-text-muted">{dateLabel}</p>
        </div>
        <button
          aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          onClick={onToggleFavorite}
          className="p-1 -m-1 shrink-0 transition-transform active:scale-125"
        >
          <Heart
            className={clsx(
              "h-4 w-4 transition-colors",
              favorite ? "text-catdex-orange fill-catdex-orange" : "text-catdex-gray-light"
            )}
          />
        </button>
      </div>
    </div>
  );
}
