"use client";

interface CatAvatarProps {
  blobId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CatAvatar({ blobId, size = "md", className = "" }: CatAvatarProps) {
  const url = `/api/photos/${blobId}${size === "sm" ? "?thumb=1" : ""}`;

  return (
    <img
      src={url}
      alt="Cat photo"
      className={`object-cover ${className}`}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
