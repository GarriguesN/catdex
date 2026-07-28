"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, MapPin, Check, AlertTriangle, ChevronRight } from "lucide-react";

const ONBOARDING_KEY = "catdex_onboarding_done";

interface OnboardingModalProps {
  onComplete: () => void;
}

type Step = "camera" | "location" | "done";

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("camera");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");

  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const isAndroid = /android/.test(navigator.userAgent.toLowerCase());

  function getPermissionHelp(type: "camera" | "gps"): string {
    const device = isIOS ? "iPhone" : isAndroid ? "dispositivo" : "navegador";
    if (isIOS) {
      return type === "camera"
        ? "Ve a Ajustes > Safari (o CatDex) > Cámara y dale a Permitir"
        : "Ve a Ajustes > Privacidad > Localización > Safari y actívala";
    }
    if (isAndroid) {
      return type === "camera"
        ? "Toca el candado en la barra de Chrome > Permisos > Cámara > Permitir"
        : "Toca el candado en Chrome > Permisos > Ubicación > Permitir";
    }
    return "Revisa la configuración de permisos de tu navegador";
  }

  // ── Camera ──

  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setCameraStatus("granted");
      // Advance to next step after brief pause
      setTimeout(() => setStep("location"), 600);
    } catch (err: any) {
      setCameraStatus("denied");
      setCameraMessage(getPermissionHelp("camera"));
    }
  }, []);

  // ── Location ──

  const requestLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus("granted");
        finish();
      },
      () => {
        setLocationStatus("denied");
        setLocationMessage(getPermissionHelp("gps"));
      },
      { timeout: 8000 }
    );
  }, []);

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onComplete();
  }

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 bg-catdex-cream flex flex-col">
      {/* Header — logo + progress */}
      <div className="pt-12 pb-6 px-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl border-2 border-catdex-border bg-white flex items-center justify-center shadow-sm">
          <img src="/icon-192.png" alt="CatDex" className="w-12 h-12" />
        </div>
        <h1 className="text-xl font-bold text-catdex-text">¡Bienvenido a la colonia!</h1>
        <p className="text-sm text-catdex-text-muted mt-1">
          {step === "camera"
            ? "Prepara tu cámara para empezar a capturar gatos"
            : "Un último paso para el mapa colaborativo"}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-2 mb-8">
        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${step === "camera" ? "bg-[#FC791A]" : "bg-[#6ABF95]"}`} />
        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${step === "location" ? "bg-[#FC791A]" : step === "done" ? "bg-[#6ABF95]" : "bg-[#A9A9A9]/30"}`} />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col items-center justify-center -mt-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Camera step */}
          <div className={`card-pokedex p-5 transition-opacity ${step !== "camera" ? "opacity-40" : ""}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#FC791A]/10 flex items-center justify-center flex-shrink-0">
                <Camera className="h-5 w-5 text-[#FC791A]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Cámara</h3>
                <p className="text-xs text-catdex-text-muted mt-0.5">
                  Necesitamos tu cámara para fotografiar gatos salvajes
                </p>

                {cameraStatus === "idle" && (
                  <button onClick={requestCamera} className="btn-pokedex w-full mt-4 text-sm">
                    Activar Cámara
                  </button>
                )}

                {cameraStatus === "granted" && (
                  <div className="flex items-center gap-2 mt-3 text-[#6ABF95]">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">¡Cámara lista!</span>
                  </div>
                )}

                {cameraStatus === "denied" && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 leading-relaxed">{cameraMessage}</p>
                    </div>
                    <button onClick={requestCamera} className="btn-pokedex w-full mt-3 text-sm">
                      Reintentar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Location step */}
          <div className={`card-pokedex p-5 transition-opacity ${step !== "location" ? "opacity-40" : ""}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#FC791A]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-[#FC791A]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Ubicación</h3>
                <p className="text-xs text-catdex-text-muted mt-0.5">
                  Los gatos aparecerán en el mapa colaborativo con tus amigos
                </p>

                {locationStatus === "idle" && (
                  <div className="space-y-2 mt-4">
                    <button onClick={requestLocation} className="btn-pokedex w-full text-sm">
                      Activar GPS
                    </button>
                    <button onClick={finish} className="btn-pokedex-secondary w-full text-sm">
                      Quizás más tarde (sin mapa)
                    </button>
                  </div>
                )}

                {locationStatus === "granted" && (
                  <div className="flex items-center gap-2 mt-3 text-[#6ABF95]">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">¡GPS listo!</span>
                  </div>
                )}

                {locationStatus === "denied" && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 leading-relaxed">{locationMessage}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={requestLocation} className="btn-pokedex flex-1 text-xs">
                        Reintentar
                      </button>
                      <button onClick={finish} className="btn-pokedex-secondary flex-1 text-xs">
                        Sin mapa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-xs text-catdex-text-muted">
          Puedes cambiar estos permisos en cualquier momento desde Ajustes
        </p>
      </div>
    </div>
  );
}

/** Check if onboarding is done (for parent components) */
export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}
