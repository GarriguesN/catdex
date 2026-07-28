"use client";

import { useState } from "react";
import { Camera, MapPin, Check, X, AlertTriangle } from "lucide-react";
import { openCamera, isCameraAvailable } from "@/lib/camera";
import { getCurrentPosition, isGeolocationAvailable } from "@/lib/geo";
import { getPocketBase } from "@/lib/pocketbase";

const PERMISSIONS_KEY = "catdex_permissions_granted";

export function isPermissionsGranted(): boolean {
  return localStorage.getItem(PERMISSIONS_KEY) === "1";
}

type PermStatus = "idle" | "requesting" | "granted" | "denied";

interface PermissionsGateProps {
  onComplete: () => void;
}

function getPermissionHelp(type: "camera" | "gps"): string {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
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

export function PermissionsGate({ onComplete }: PermissionsGateProps) {
  const [cameraStatus, setCameraStatus] = useState<PermStatus>("idle");
  const [locationStatus, setLocationStatus] = useState<PermStatus>("idle");
  const [helpMessage, setHelpMessage] = useState("");
  const [requesting, setRequesting] = useState(false);

  async function requestCamera(): Promise<boolean> {
    if (!isCameraAvailable()) {
      setCameraStatus("denied");
      return false;
    }
    setCameraStatus("requesting");
    try {
      const stream = await openCamera();
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus("granted");
      return true;
    } catch {
      setCameraStatus("denied");
      return false;
    }
  }

  async function requestLocation(): Promise<boolean> {
    if (!isGeolocationAvailable()) {
      setLocationStatus("denied");
      return false;
    }
    setLocationStatus("requesting");
    try {
      await getCurrentPosition();
      setLocationStatus("granted");
      return true;
    } catch {
      setLocationStatus("denied");
      return false;
    }
  }

  async function handleContinue() {
    setRequesting(true);
    setHelpMessage("");

    const camOk = await requestCamera();
    const locOk = await requestLocation();

    setRequesting(false);

    if (camOk && locOk) {
      localStorage.setItem(PERMISSIONS_KEY, "1");
      onComplete();
    } else {
      setHelpMessage(getPermissionHelp(!camOk ? "camera" : "gps"));
    }
  }

  function handleNotNow() {
    // Camera + location are mandatory — declining means no access to CatDex yet.
    getPocketBase().authStore.clear();
    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-50 bg-catdex-cream flex flex-col overflow-y-auto">
      {/* Decorative header */}
      <div className="relative pt-14 pb-6 px-6 text-center">
        <MapPin className="absolute top-16 left-8 h-5 w-5 text-catdex-orange/50" />
        <Camera className="absolute top-14 right-8 h-6 w-6 text-catdex-orange/70" />
        <span className="absolute top-8 left-16 w-2 h-2 rounded-full bg-catdex-orange/40" />
        <span className="absolute top-24 right-16 w-1.5 h-1.5 rounded-full bg-catdex-green/40" />
        <span className="absolute top-10 right-24 w-1 h-1 rounded-full bg-catdex-text/20" />

        <div className="w-28 h-28 mx-auto mb-6 rounded-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          <img src="/icono.png" alt="CatDex" className="w-full h-full object-cover scale-125" />
        </div>

        <h1 className="text-2xl font-bold text-catdex-text leading-tight">
          Para capturar gatos,<br />necesitamos tu permiso
        </h1>
        <p className="text-sm text-catdex-text-muted mt-3 max-w-xs mx-auto">
          CatDex necesita acceder a algunas funciones de tu dispositivo para funcionar correctamente.
        </p>
      </div>

      {/* Permission rows */}
      <div className="flex-1 px-6 space-y-3">
        <PermissionRow
          icon={Camera}
          title="Cámara"
          description="Para tomar fotos de gatos"
          status={cameraStatus}
        />
        <PermissionRow
          icon={MapPin}
          title="Ubicación"
          description="Para guardar dónde encuentras a los gatos"
          status={locationStatus}
        />

        {helpMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-relaxed">
              Necesitamos ambos permisos para poder usar CatDex. {helpMessage}
            </p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-6 pt-4 space-y-3">
        <button
          onClick={handleContinue}
          disabled={requesting}
          className="w-full bg-catdex-orange text-white font-bold rounded-full py-3.5 text-base shadow-[0_4px_14px_rgba(255,138,38,0.35)] active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {requesting ? "Solicitando permisos…" : "Continuar"}
        </button>
        <button
          onClick={handleNotNow}
          disabled={requesting}
          className="w-full text-center text-sm text-catdex-text-muted hover:text-catdex-text py-1"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}

function PermissionRow({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: typeof Camera;
  title: string;
  description: string;
  status: PermStatus;
}) {
  return (
    <div className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      <div className="w-10 h-10 rounded-xl bg-catdex-orange/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-catdex-orange" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-catdex-text-muted mt-0.5">{description}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function StatusBadge({ status }: { status: PermStatus }) {
  if (status === "granted") {
    return (
      <div className="w-6 h-6 rounded-full bg-catdex-green flex items-center justify-center flex-shrink-0">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="w-6 h-6 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
        <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === "requesting") {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-catdex-orange border-t-transparent animate-spin flex-shrink-0" />
    );
  }
  return <div className="w-6 h-6 rounded-full border-2 border-catdex-gray-light/40 flex-shrink-0" />;
}
