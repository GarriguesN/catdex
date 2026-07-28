"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoto, blurScore, getImageData } from "@/lib/image";
import { openCamera, captureFrame, isCameraAvailable } from "@/lib/camera";
import { generateCatName } from "@/lib/names";
import { getCurrentPosition, formatCoords } from "@/lib/geo";
import { generateUUID } from "@/lib/utils";
import { classifyPhoto, type ClassificationResult } from "@/lib/classifier";
import { CatPicker } from "@/components/CatPicker";
import { BadgeUnlock } from "@/components/BadgeUnlock";
import { motion, AnimatePresence } from "framer-motion";
import { playShutterSound, playMissSound, playCaptureSound } from "@/lib/sounds";
import { ArrowLeft, Camera, Upload, Zap } from "lucide-react";
import Link from "next/link";

export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [newBadges, setNewBadges] = useState<string[] | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [showClassWarning, setShowClassWarning] = useState(false);
  const [flash, setFlash] = useState(false);
  const pendingDataRef = useRef<{
    blob: Blob; thumbBlob: Blob; width: number; height: number;
    lat?: number; lng?: number;
  } | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const s = await openCamera();
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { setCameraError(true); }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }, [stream]);

  const captureFromVideo = useCallback(async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    playShutterSound();
    try {
      const canvas = captureFrame(videoRef.current);
      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), "image/jpeg", 0.9));
      setPreviewUrl(URL.createObjectURL(blob));
      await processCapture(blob);
    } finally { setCapturing(false); }
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturing(true);
    setPreviewUrl(URL.createObjectURL(file));
    await processCapture(file);
    setCapturing(false);
  }, []);

  async function processCapture(file: Blob) {
    try {
      const { blob, thumbBlob, width, height } = await normalizePhoto(new File([file], "capture.jpg", { type: file.type }));
      pendingDataRef.current = { blob, thumbBlob, width, height };

      // GPS
      try {
        const pos = await getCurrentPosition();
        const c = formatCoords(pos.coords.latitude, pos.coords.longitude);
        pendingDataRef.current.lat = c.lat;
        pendingDataRef.current.lng = c.lng;
      } catch {}

      // Blur check
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise(r => img.onload = r);
      const bc = document.createElement("canvas"); bc.width = img.width; bc.height = img.height;
      bc.getContext("2d")!.drawImage(img, 0, 0);
      const bv = blurScore(getImageData(bc));

      // Classification
      let result: ClassificationResult;
      if (bv < 50) {
        result = { isCat: true, topClass: "unknown", confidence: 0, quality: "blurry" as const, message: "¡Demasiado borroso! ¿Repetimos?" };
      } else {
        result = await classifyPhoto(img);
      }
      setClassification(result);

      if (result.quality !== "good") {
        if (result.quality === "not_cat") playMissSound();
        setShowClassWarning(true);
        return;
      }

      setShowPicker(true);
    } catch (err) {
      console.error("Capture failed:", err);
      alert("Error al procesar la foto.");
    }
  }

  async function handleCatSelect(catId: string | null) {
    setShowPicker(false);
    playCaptureSound();
    const pending = pendingDataRef.current;
    if (!pending) return;

    if (catId) {
      // Upload photo to existing cat
      const form = new FormData();
      form.append("catId", catId);
      form.append("photo", pending.blob);
      form.append("thumb", pending.thumbBlob);
      form.append("width", String(pending.width));
      form.append("height", String(pending.height));
      if (pending.lat) form.append("lat", String(pending.lat));
      if (pending.lng) form.append("lng", String(pending.lng));

      const res = await fetch("/api/photos", { method: "POST", body: form });
      if (res.ok) router.push(`/cat?id=${catId}`);
    } else {
      // Create new cat + upload photo
      const catId = generateUUID();
      const name = generateCatName();

      await fetch("/api/cats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: catId, name }),
      });

      const form = new FormData();
      form.append("catId", catId);
      form.append("photo", pending.blob);
      form.append("thumb", pending.thumbBlob);
      form.append("width", String(pending.width));
      form.append("height", String(pending.height));
      if (pending.lat) form.append("lat", String(pending.lat));
      if (pending.lng) form.append("lng", String(pending.lng));

      const res = await fetch("/api/photos", { method: "POST", body: form });
      if (res.ok) router.push(`/cat?id=${catId}`);
    }
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold">Atrapar</h1>
      </div>

      <AnimatePresence>
        {flash && <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-50 bg-white pointer-events-none" />}
      </AnimatePresence>

      {!previewUrl ? (
        <div className="relative aspect-[3/4] bg-catdex-input-bg rounded-xl overflow-hidden border-2 border-catdex-border">
          {!stream && !cameraError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
              <Camera className="h-12 w-12 text-catdex-text-muted" />
              <p className="text-sm text-catdex-text-muted text-center">Apunta a un gato y hazle una foto</p>
              {isCameraAvailable() && <button onClick={startCamera} className="btn-pokedex flex items-center gap-2"><Zap className="h-4 w-4" />Abrir cámara</button>}
              <button onClick={() => fileInputRef.current?.click()} className="btn-pokedex-secondary flex items-center gap-2"><Upload className="h-4 w-4" />Subir foto</button>
            </div>
          ) : stream ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <button onClick={captureFromVideo} disabled={capturing} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-catdex-orange active:scale-90 transition-transform" />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
              <p className="text-sm text-catdex-text-muted">Cámara no disponible</p>
              <button onClick={() => fileInputRef.current?.click()} className="btn-pokedex-secondary"><Upload className="h-4 w-4" />Subir foto</button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-catdex-border">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          {capturing && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-catdex-orange border-t-transparent rounded-full animate-spin" /></div>}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />

      {showClassWarning && classification && (
        <div className="fixed inset-0 z-50 bg-catdex-cream/95 flex flex-col items-center justify-center p-6 animate-pop-in">
          <span className="text-5xl mb-4">{classification.quality === "not_cat" ? "💨" : "🔍"}</span>
          <h2 className="text-lg font-bold mb-2 text-center">{classification.quality === "not_cat" ? "¡Se te ha escapado!" : "Mmm… 🤔"}</h2>
          <p className="text-sm text-catdex-text-muted text-center mb-6 max-w-xs">{classification.message}</p>
          <div className="flex gap-3 w-full max-w-xs">
            <button onClick={() => { setShowClassWarning(false); setClassification(null); setPreviewUrl(null); pendingDataRef.current = null; stopCamera(); }} className="btn-pokedex flex-1">Repetir foto</button>
            <button onClick={() => { setShowClassWarning(false); setShowPicker(true); }} className="btn-pokedex-secondary flex-1">Guardar igual</button>
          </div>
        </div>
      )}

      {showPicker && <CatPicker onSelect={handleCatSelect} onCancel={() => { setShowPicker(false); setPreviewUrl(null); pendingDataRef.current = null; stopCamera(); }} />}

      {newBadges && <BadgeUnlock achievementIds={newBadges} onClose={() => { setNewBadges(null); router.push("/"); }} />}
    </div>
  );
}
