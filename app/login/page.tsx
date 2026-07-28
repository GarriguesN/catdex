"use client";

import { useState } from "react";
import { getPocketBase } from "@/lib/pocketbase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loginWithGoogle() {
    setLoading(true);
    setError("");
    try {
      const pb = getPocketBase();
      await pb.collection("users").authWithOAuth2({
        provider: "google",
        scopes: ["profile", "email"],
      });
      // Will redirect to Google, then back — auth state auto-updates
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-catdex-cream">
      <div className="max-w-sm w-full flex flex-col items-center">
        {/* Logo */}
        <div className="w-36 h-36 rounded-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          <img src="/icono.png" alt="CatDex" className="w-full h-full object-cover scale-125" />
        </div>

        {/* Wordmark */}
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight">
          <span className="text-catdex-text">Cat</span>
          <span className="text-catdex-orange">Dex</span>
        </h1>
        <p className="mt-1.5 text-sm text-catdex-text-muted">
          Tu Pokédex de gatos reales
        </p>

        {/* Error */}
        {error && (
          <div className="mt-8 w-full p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Google sign-in */}
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-3 bg-white rounded-full px-6 py-4 font-semibold text-catdex-text shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-black/5 hover:bg-catdex-input-bg transition-colors active:scale-[0.98] disabled:opacity-50 ${error ? "mt-4" : "mt-10"}`}
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? "Conectando…" : "Continuar con Google"}
        </button>

        <p className="mt-6 text-xs text-catdex-text-muted text-center max-w-[280px]">
          Tus fotos se guardan en la nube. Compite con tus amigos por ver quién atrapa más gatos.
        </p>
      </div>
    </div>
  );
}
