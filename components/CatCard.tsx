"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, type Cat } from "@/lib/db";
import { Camera } from "lucide-react";

interface CatCardProps {
  cat: Cat;
}

export function CatCard({ cat }: CatCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    loadThumb();
  }, [cat.thumbBlobId]);

  async function loadThumb() {
    try {
      const photo = await db.photos.get(cat.thumbBlobId);
      if (photo?.thumbBlob) {
        setThumbUrl(URL.createObjectURL(photo.thumbBlob));
      }
    } catch {
      // Blob not available
    }
  }

  return (
    <Link
      href={`/cat?id=${cat.id}`}
      className="card-pokedex group active:scale-[0.98] transition-transform"
    >
      {/* Photo area */}
      <div className="aspect-square bg-pokedex-gray-mid relative overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={cat.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="font-semibold text-sm truncate">{cat.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cat.photoCount} foto{cat.photoCount !== 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}
