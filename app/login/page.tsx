"use client";

import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { getPocketBase } from "@/lib/pocketbase";
import { Logo } from "@/components/ui/Logo";
import { isStandalonePWA } from "@/lib/pwa";

type Mode = "login" | "register";

/** Keeps only the last (correctly filled) redirect_uri if the auth URL has duplicates. */
function dedupeRedirectUri(url: string): string {
  const u = new URL(url);
  const values = u.searchParams.getAll("redirect_uri").filter(Boolean);
  if (values.length > 0) {
    u.searchParams.delete("redirect_uri");
    u.searchParams.set("redirect_uri", values[values.length - 1]);
  }
  return u.toString();
}

// sessionStorage key for the pending-redirect OAuth flow (see loginWithOAuth).
const PENDING_OAUTH_KEY = "catdex_oauth_pending";

interface PendingOAuth {
  provider: "google" | "apple";
  codeVerifier: string;
  redirectUrl: string;
  state: string;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function done() {
    window.location.href = "/";
  }

  // Landing back here after the standalone-PWA redirect flow (see
  // loginWithOAuth): the URL now carries the OAuth provider's ?code&state.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code) return;

    const raw = sessionStorage.getItem(PENDING_OAUTH_KEY);
    sessionStorage.removeItem(PENDING_OAUTH_KEY);
    window.history.replaceState(null, "", window.location.pathname);

    if (!raw) return;
    const pending: PendingOAuth = JSON.parse(raw);
    if (pending.state !== state) {
      setError("No se ha podido verificar el inicio de sesión. Inténtalo de nuevo.");
      return;
    }

    setLoading(true);
    getPocketBase()
      .collection("users")
      .authWithOAuth2Code(pending.provider, code, pending.codeVerifier, pending.redirectUrl)
      .then(done)
      .catch((err: any) => {
        setError(err?.message || "No se ha podido completar el inicio de sesión");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const pb = getPocketBase();
      if (mode === "register") {
        await pb.collection("users").create({ email, password, passwordConfirm: password });
      }
      await pb.collection("users").authWithPassword(email, password);
      done();
    } catch (err: any) {
      setError(err?.message || "No se ha podido iniciar sesión");
      setLoading(false);
    }
  }

  async function loginWithOAuth(provider: "google" | "apple") {
    setLoading(true);
    setError("");
    setNotice("");

    // Installed PWAs run without normal browser chrome/tabs, so window.open()
    // popups are unreliable there (they can spawn a detached window whose
    // result never makes it back, losing the session entirely). Skip popups
    // altogether in that case and do a plain top-level redirect instead: no
    // window.open, so nothing to lose track of.
    if (isStandalonePWA()) {
      try {
        const pb = getPocketBase();
        const methods = await pb.collection("users").listAuthMethods();
        const providerInfo = methods.oauth2.providers.find((p) => p.name === provider);
        if (!providerInfo) throw new Error(`Proveedor "${provider}" no disponible`);

        const redirectUrl = `${window.location.origin}/login`;
        const pending: PendingOAuth = {
          provider,
          codeVerifier: providerInfo.codeVerifier,
          redirectUrl,
          state: providerInfo.state,
        };
        sessionStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify(pending));
        // authURL is deliberately meant to be concatenated with the redirect
        // URL directly (not set via URLSearchParams) — see dedupeRedirectUri
        // above for what goes wrong when a redirect_uri ends up duplicated.
        window.location.href = providerInfo.authURL + encodeURIComponent(redirectUrl);
      } catch (err: any) {
        setError(err?.message || `No se ha podido conectar con ${provider === "google" ? "Google" : "Apple"}`);
        setLoading(false);
      }
      return;
    }

    // The pocketbase JS SDK's default popup flow can emit a duplicated
    // (first empty) redirect_uri param, which OAuth providers reject as
    // missing. Open the popup ourselves and sanitize the URL it's sent to.
    const popup = window.open("", "popup_window", "width=500,height=650,resizable,menubar=no");
    try {
      const pb = getPocketBase();
      await pb.collection("users").authWithOAuth2({
        provider,
        scopes: ["profile", "email"],
        urlCallback: (url) => {
          const fixedUrl = dedupeRedirectUri(url);
          if (popup && !popup.closed) popup.location.href = fixedUrl;
          else window.location.href = fixedUrl;
        },
      });
      done();
    } catch (err: any) {
      popup?.close();
      setError(err?.message || `No se ha podido conectar con ${provider === "google" ? "Google" : "Apple"}`);
      setLoading(false);
    }
  }

  async function forgotPassword() {
    if (!email) {
      setError("Escribe tu correo para recuperar la contraseña");
      return;
    }
    setError("");
    try {
      await getPocketBase().collection("users").requestPasswordReset(email);
      setNotice("Te hemos enviado un correo para restablecerla");
    } catch {
      setNotice("Te hemos enviado un correo para restablecerla");
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-sm">
        <Logo size={104} wordmark className="mb-9" />

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-catdex-red/8 text-sm text-catdex-red text-center animate-fade-up">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 p-3 rounded-2xl bg-catdex-green/8 text-sm text-catdex-green text-center animate-fade-up">
            {notice}
          </div>
        )}

        <form onSubmit={submitEmail} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[0.8125rem] font-semibold text-catdex-text mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-catdex-gray-light pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="field pl-10"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-[0.8125rem] font-semibold text-catdex-text mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-catdex-gray-light pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="field pl-10 pr-11"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-catdex-gray-light"
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
            {mode === "login" && (
              <div className="text-right mt-1.5">
                <button
                  type="button"
                  onClick={forgotPassword}
                  className="text-xs font-medium text-catdex-orange"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? "Conectando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-catdex-hairline" />
          <span className="text-xs text-catdex-gray-light">o continúa con</span>
          <div className="flex-1 h-px bg-catdex-hairline" />
        </div>

        <div className="space-y-3">
          <button
            onClick={() => loginWithOAuth("google")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-catdex-surface rounded-2xl px-6 py-3.5 font-semibold text-[0.9375rem] text-catdex-text shadow-soft transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <GoogleIcon />
            Continuar con Google
          </button>
          <button
            onClick={() => loginWithOAuth("apple")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-catdex-surface rounded-2xl px-6 py-3.5 font-semibold text-[0.9375rem] text-catdex-text shadow-soft transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <AppleIcon />
            Continuar con Apple
          </button>
        </div>

        <p className="text-center text-[0.8125rem] text-catdex-text-muted mt-7">
          {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            onClick={() => {
              setMode((m) => (m === "login" ? "register" : "login"));
              setError("");
              setNotice("");
            }}
            className="font-semibold text-catdex-orange"
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
