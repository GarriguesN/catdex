"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { getPocketBase } from "@/lib/pocketbase";
import { Sheet } from "@/components/ui/Sheet";

/**
 * "Editar perfil" — the only place where users.name / users.avatar can be set
 * (signup only asks for email/password).
 */
export function EditProfileSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: Record<string, any> | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pb = getPocketBase();
  const currentAvatar =
    user?.avatar && `${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}?thumb=200x200`;
  const shownName = name ?? user?.name ?? "";
  const shownAvatar = avatarPreview || currentAvatar;
  const initial = (shownName[0] || user?.email?.[0] || "?").toUpperCase();

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", shownName.trim());
      if (avatarFile) form.append("avatar", avatarFile);
      await pb.collection("users").update(user.id, form);
      // Sync authStore.record (fires pb-auth-change → AuthProvider refresh)
      await pb.collection("users").authRefresh();
      handleClose();
    } catch (err) {
      console.error("Profile update failed:", err);
      setError("No se han podido guardar los cambios. Inténtalo de nuevo.");
    }
    setSaving(false);
  }

  function handleClose() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setName(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setError("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={handleClose}>
      <div className="px-6 pt-2 pb-4">
        <h2 className="text-base font-bold mb-4">Editar perfil</h2>

        <div className="flex flex-col items-center gap-3 mb-5">
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Cambiar avatar"
            className="relative active:scale-95 transition-transform"
          >
            {shownAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownAvatar} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <span className="w-24 h-24 rounded-full bg-catdex-orange/15 text-catdex-orange text-3xl font-bold flex items-center justify-center">
                {initial}
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-catdex-orange text-white flex items-center justify-center border-[3px] border-catdex-surface">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
        </div>

        <label className="block text-[0.8125rem] font-semibold text-catdex-text-muted mb-1.5 px-1">
          Nombre
        </label>
        <input
          className="field"
          placeholder="Tu nombre"
          value={shownName}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />

        {error && <p className="text-[0.8125rem] text-catdex-red mt-2">{error}</p>}

        <button onClick={save} disabled={saving} className="btn-primary w-full mt-5">
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Sheet>
  );
}
