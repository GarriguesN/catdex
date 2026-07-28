"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { normalizePhoto } from "@/lib/image";
import { openCamera, captureFrame, isCameraAvailable } from "@/lib/camera";
import { computeHashFromCanvas } from "@/lib/capture";
import { generateCatName } from "@/lib/names";
import { checkAchievements } from "@/lib/achievements";
import { getCurrentPosition, formatCoords } from "@/lib/geo";
import { generateUUID } from "@/lib/utils";
import { CatPicker } from "@/components/CatPicker";
import { BadgeUnlock } from "@/components/BadgeUnlock";
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
  const pendingDataRef = useRef<{
    blob: Blob;
    thumbBlob: Blob;
    width: number;
    height: number;
    hash: string;
    lat?: number;
    lng?: number;
  } | null>(null);

  // ── Camera ──────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const s = await openCamera();
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setCameraError(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  const captureFromVideo = useCallback(async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    try {
      const canvas = captureFrame(videoRef.current);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9)
      );
      setPreviewUrl(URL.createObjectURL(blob));
      await processCapture(blob);
    } finally {
      setCapturing(false);
    }
  }, []);

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCapturing(true);
      setPreviewUrl(URL.createObjectURL(file));
      await processCapture(file);
      setCapturing(false);
    },
    []
  );

  // ── Pipeline ────────────────────────────────────────────

  async function processCapture(file: Blob) {
    try {
      // 1. Normalize (resize + WebP/JPEG)
      const { blob, thumbBlob, width, height } = await normalizePhoto(
        new File([file], "capture.jpg", { type: file.type })
      );

      // 2. Compute pHash (stored but NOT used for matching)
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise((r) => (img.onload = r));
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      const hash = await computeHashFromCanvas(c);

      // 3. GPS if available
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await getCurrentPosition();
        const coords = formatCoords(pos.coords.latitude, pos.coords.longitude);
        lat = coords.lat;
        lng = coords.lng;
      } catch { /* no GPS */ }

      // 4. Store pending data, show manual picker
      pendingDataRef.current = { blob, thumbBlob, width, height, hash, lat, lng };
      setShowPicker(true);
    } catch (err) {
      console.error("Capture failed:", err);
      alert("Error al procesar la foto. Intenta de nuevo.");
    }
  }

  // ── CatPicker callback ──────────────────────────────────

  async function handleCatSelect(catId: string | null) {
    setShowPicker(false);
    const pending = pendingDataRef.current;
    if (!pending) return;

    if (catId) {
      // Add photo to existing cat
      const cat = await db.cats.get(catId);
      if (!cat) return;

      const photoId = generateUUID();
      await db.photos.put({
        id: photoId,
        catId,
        blob: pending.blob,
        thumbBlob: pending.thumbBlob,
        takenAt: Date.now(),
        lat: pending.lat,
        lng: pending.lng,
        pHash: pending.hash,
        width: pending.width,
        height: pending.height,
        bytes: pending.blob.size,
      });

      await db.cats.update(catId, {
        lastSeen: Date.now(),
        photoCount: cat.photoCount + 1,
      });

      router.push(`/cat?id=${catId}`);
    } else {
      // New cat
      const catId = generateUUID();
      const photoId = generateUUID();
      const name = await generateCatName();

      await db.cats.put({
        id: catId,
        hash: pending.hash,
        name,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        photoCount: 1,
        thumbBlobId: photoId,
        manuallyNamed: false,
      });

      await db.photos.put({
        id: photoId,
        catId,
        blob: pending.blob,
        thumbBlob: pending.thumbBlob,
        takenAt: Date.now(),
        lat: pending.lat,
        lng: pending.lng,
        pHash: pending.hash,
        width: pending.width,
        height: pending.height,
        bytes: pending.blob.size,
      });

      const badges = await checkAchievements();
      if (badges.length > 0) {
        setNewBadges(badges.map((b) => b.id));
      } else {
        router.push(`/cat?id=${catId}`);
      }
    }
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Atrapar</h1>
      </div>

      {/* Camera / Preview */}
      {!previewUrl ? (
        <div className="relative aspect-[3/4] bg-pokedex-gray-dark rounded-xl overflow-hidden">
          {!stream && !cameraError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Apunta a un gato y hazle una foto
              </p>
              {isCameraAvailable() ? (
                <button onClick={startCamera} className="btn-pokedex flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Abrir cámara
                </button>
              ) : null}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-pokedex-secondary flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Subir foto
              </button>
            </div>
          ) : stream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <button
                onClick={captureFromVideo}
                disabled={capturing}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-pokedex-red active:scale-90 transition-transform flex items-center justify-center"
              >
                {capturing && (
                  <div className="w-8 h-8 border-4 border-pokedex-red border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
              <p className="text-sm text-muted-foreground">Cámara no disponible</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-pokedex-secondary flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Subir foto
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          {capturing && (
            <div className="absolute inset-0 bg-pokedex-black/50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-pokedex-red border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Procesando...</p>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Manual cat picker */}
      {showPicker && (
        <CatPicker
          onSelect={handleCatSelect}
          onCancel={() => {
            setShowPicker(false);
            setPreviewUrl(null);
            pendingDataRef.current = null;
            stopCamera();
          }}
        />
      )}

      {/* Badge unlock */}
      {newBadges && (
        <BadgeUnlock
          achievementIds={newBadges}
          onClose={() => {
            setNewBadges(null);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
