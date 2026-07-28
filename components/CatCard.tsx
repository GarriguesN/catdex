"use client";

import Link from "next/link";
import { Camera } from "lucide-react";

interface Cat {
  id: string;
  name: string;
  photo_count: number;
  thumb_blob_id: string;
}

export function CatCard({ cat }: { cat: Cat }) {
  const thumbUrl = cat.thumb_blob_id
    ? `/api/photos/${cat.thumb_blob_id}?thumb=1`
    : null;

  return (
    <Link
      href={`/cat?id=${cat.id}`}
      className="card-pokedex group active:scale-[0.98] transition-transform"
    >
      <div className="aspect-square bg-catdex-input-bg relative overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={cat.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="h-8 w-8 text-catdex-text-muted" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="font-semibold text-sm truncate">{cat.name}</h3>
        <p className="text-xs text-catdex-text-muted mt-0.5">
          {cat.photo_count} foto{cat.photo_count !== 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}
