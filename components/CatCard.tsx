"use client";

import Link from "next/link";
import { Heart, Camera } from "lucide-react";
import clsx from "clsx";

interface CatCardProps {
  id: string;
  rank: number;
  name: string;
  thumbUrl: string | null;
  date: Date;
  favorite: boolean;
  onToggleFavorite: () => void;
}

/** Photo tile for the collection grid: numbered badge, name + date, heart. */
export function CatCard({ id, rank, name, thumbUrl, date, favorite, onToggleFavorite }: CatCardProps) {
  const dateLabel = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="animate-fade-up">
      <Link
        href={`/cat?id=${id}`}
        className="relative block aspect-square rounded-2xl overflow-hidden bg-catdex-input-bg shadow-soft transition-transform active:scale-[0.97]"
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="w-full h-full flex items-center justify-center">
            <Camera className="h-7 w-7 text-catdex-gray-light" />
          </span>
        )}
        <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-catdex-text text-[0.6875rem] font-bold px-2 py-0.5 rounded-full shadow-soft">
          #{rank}
        </span>
      </Link>
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
