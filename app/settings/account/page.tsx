"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-provider";
import { getPocketBase } from "@/lib/pocketbase";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsRow";
import { ConfirmDialog } from "@/components/ui/Sheet";

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storageInfo, setStorageInfo] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    estimateStorage();
  }, []);

  async function estimateStorage() {
    try {
      const estimate = await navigator.storage?.estimate();
      if (estimate) {
        const used = ((estimate.usage || 0) / 1024 / 1024).toFixed(1);
        setStorageInfo(`${used} MB usados en este dispositivo`);
      }
    } catch {
      setStorageInfo("");
    }
  }

  function logout() {
    getPocketBase().authStore.clear();
    router.replace("/login");
  }

  async function deleteAll() {
    setDeleting(true);
    try {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;

      const cats = await pb.collection("cats").getFullList({ filter: `discoveredBy="${userId}"` });

      if (cats.length > 0) {
        const catFilter = cats.map(cat => `cat="${cat.id}"`).join(" || ");
        const photos = await pb.collection("photos").getFullList({ filter: catFilter });

        await Promise.all(photos.map(photo => pb.collection("photos").delete(photo.id)));
        await Promise.all(cats.map(cat => pb.collection("cats").delete(cat.id)));
      }

      window.location.href = "/";
    } catch (err) {
      alert("Error: " + (err as Error).message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const name = user?.name || user?.email?.split("@")[0] || "Sin sesión";
  const initial = (name[0] || "?").toUpperCase();

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Cuenta" />

      {/* Profile header */}
      <Card className="flex items-center gap-4">
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${getPocketBase().baseUrl}/api/files/users/${user.id}/${user.avatar}?thumb=100x100`}
            alt=""
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <span className="w-14 h-14 rounded-full bg-catdex-orange/15 text-catdex-orange text-xl font-bold flex items-center justify-center">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-bold text-base truncate">{name}</p>
          <p className="text-[0.8125rem] text-catdex-text-muted truncate">{user?.email || ""}</p>
          {storageInfo && <p className="text-xs text-catdex-gray-light mt-0.5">{storageInfo}</p>}
        </div>
      </Card>

      <SettingsGroup>
        <SettingsRow icon={<LogOut className="h-5 w-5" />} label="Cerrar sesión" onClick={logout} chevron={false} />
        <SettingsRow
          icon={<Trash2 className="h-5 w-5" />}
          label="Borrar toda la colección"
          onClick={() => setShowDeleteConfirm(true)}
          chevron={false}
          destructive
        />
      </SettingsGroup>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="¿Borrar toda la colección?"
        message="Se eliminarán todos tus gatos y sus fotos. Esta acción no se puede deshacer."
        confirmLabel={deleting ? "Borrando…" : "Borrar todo"}
        destructive
        onConfirm={deleteAll}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
