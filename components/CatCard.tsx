"use client";

import Link from "next/link";
import { Heart, Camera } from "lucide-react";
import clsx from "clsx";

interface CatCardProps {
  id: string;
  thumbUrl: string | null;
  date: Date;
  favorite: boolean;
  onToggleFavorite: () => void;
}

/** Photo tile for the collection grid: rounded photo, date + heart below. */
export function CatCard({ id, thumbUrl, date, favorite, onToggleFavorite }: CatCardProps) {
  const dateLabel = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="animate-fade-up">
      <Link
        href={`/cat?id=${id}`}
        className="block aspect-square rounded-2xl overflow-hidden bg-catdex-input-bg shadow-soft transition-transform active:scale-[0.97]"
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="w-full h-full flex items-center justify-center">
            <Camera className="h-7 w-7 text-catdex-gray-light" />
          </span>
        )}
      </Link>
      <div className="flex items-center justify-between px-1 pt-1.5">
        <span className="text-[0.6875rem] text-catdex-text-muted">{dateLabel}</span>
        <button
          aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          onClick={onToggleFavorite}
          className="p-1 -m-1 transition-transform active:scale-125"
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
