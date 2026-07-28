"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";

interface CatAvatarProps {
  blobId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CatAvatar({ blobId, size = "md", className = "" }: CatAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    loadPhoto();
  }, [blobId]);

  async function loadPhoto() {
    try {
      const photo = await db.photos.get(blobId);
      if (photo) {
        const blob = size === "sm" ? photo.thumbBlob : photo.blob;
        setUrl(URL.createObjectURL(blob));
      }
    } catch {
      // Not available
    }
  }

  if (!url) {
    return (
      <div
        className={`bg-pokedex-gray-mid flex items-center justify-center ${className}`}
      >
        <span className="text-muted-foreground text-2xl">🐱</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Cat photo"
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}
