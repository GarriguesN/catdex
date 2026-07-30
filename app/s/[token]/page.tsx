"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Cat } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { fetchSharedCat, sharedPhotoUrl, type SharedCat } from "@/lib/shares";

/**
 * The only route in the app meant for visitors without an account — opened
 * from a share link. Read-only, no auth, no bottom nav (AppShell only shows
 * chrome for a logged-in user, see components/AppShell.tsx).
 */
export default function SharedCatPage() {
  const { token } = useParams<{ token: string }>();
  const [shared, setShared] = useState<SharedCat | null | undefined>(undefined);

  useEffect(() => {
    fetchSharedCat(token).then(setShared);
  }, [token]);

  if (shared === undefined) {
    return (
      <div className="pt-3 space-y-4">
        <div className="skeleton h-10 w-32 mx-auto" />
        <div className="skeleton h-72 w-full" />
      </div>
    );
  }

  if (!shared) {
    return (
      <div className="empty-state">
        <p className="text-4xl mb-4">😿</p>
        <p className="font-semibold text-catdex-text">Enlace no válido o caducado</p>
        <Link href="/login" className="btn-primary mt-5">
          Abrir CatDex
        </Link>
      </div>
    );
  }

  const photoUrl = sharedPhotoUrl(shared);

  return (
    <div className="pt-6 flex flex-col items-center text-center">
      <Logo size={56} />

      <div className="w-full max-w-xs mt-6 card overflow-hidden">
        <div className="w-full aspect-square bg-catdex-input-bg flex items-center justify-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={shared.catName} className="w-full h-full object-cover" />
          ) : (
            <Cat className="h-12 w-12 text-catdex-gray-light" />
          )}
        </div>
        <div className="p-4">
          <h1 className="text-xl font-bold">{shared.catName || "Sin nombre"}</h1>
          {shared.discovererName && (
            <p className="text-sm text-catdex-text-muted mt-1">
              Descubierto por {shared.discovererName}
            </p>
          )}
        </div>
      </div>

      <p className="text-sm text-catdex-text-muted mt-6 max-w-xs">
        Alguien te ha compartido este gato desde CatDex — captura y colecciona gatos reales con tus amigos.
      </p>
      <Link href="/login" className="btn-primary mt-5 w-full max-w-xs">
        Únete a CatDex
      </Link>
    </div>
  );
}
