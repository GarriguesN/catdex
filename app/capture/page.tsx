"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoto, blurScore, getImageData } from "@/lib/image";
import { openCamera, captureFrame, isCameraAvailable } from "@/lib/camera";
import { generateCatName } from "@/lib/names";
import { generateUUID } from "@/lib/utils";
import { getBlurCopy, getNotCatCopy } from "@/lib/copy";
import { classifyPhoto } from "@/lib/classifier";
import { computePHash, hammingDistance, similarity } from "@/lib/phash";
import { getPocketBase } from "@/lib/pocketbase";
import { BlurCheckScreen } from "@/components/capture/BlurCheckScreen";
import { DetectingScreen } from "@/components/capture/DetectingScreen";
import { NotCatScreen } from "@/components/capture/NotCatScreen";
import { SavedScreen } from "@/components/capture/SavedScreen";
import { ArrowLeft, Zap, Upload, Camera } from "lucide-react";
import Link from "next/link";

type Screen = "camera" | "blur" | "detecting" | "notcat" | "matching" | "saved";

interface MatchCandidate {
  id: string;
  name: string;
  similarity: number;
  photoCount?: number;
}

export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("camera");
  const [blurCopy, setBlurCopy] = useState({ title: "", subtitle: "" });
  const [notCatCopy, setNotCatCopy] = useState({ title: "", subtitle: "" });
  const [isSpecificAnimal, setIsSpecificAnimal] = useState(false);
  const [savedCatId, setSavedCatId] = useState<string | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);

  const pendingBlobRef = useRef<Blob | null>(null);
  const pendingThumbBlobRef = useRef<Blob | null>(null);

  // ── Camera ──

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

  const doCapture = useCallback(async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    try {
      const canvas = captureFrame(videoRef.current);
      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), "image/jpeg", 0.9));
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      await processCapture(blob);
    } finally { setCapturing(false); }
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturing(true);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    await processCapture(file);
    setCapturing(false);
  }, []);

  // ── Pipeline ──

  async function processCapture(file: Blob) {
    // 1. Normalize
    const { blob, thumbBlob } = await normalizePhoto(new File([file], "capture.jpg", { type: file.type }));
    pendingBlobRef.current = blob;
    pendingThumbBlobRef.current = thumbBlob;
    setPreviewUrl(URL.createObjectURL(blob));

    // 2. Blur check (on raw frame, before compression)
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await new Promise(r => img.onload = r);
    const bc = document.createElement("canvas");
    bc.width = img.width; bc.height = img.height;
    bc.getContext("2d")!.drawImage(img, 0, 0);
    const bv = blurScore(getImageData(bc));

    if (bv < 50) {
      setBlurCopy(getBlurCopy());
      setScreen("blur");
      return;
    }

    // 3. MobileNet gate
    setScreen("detecting");

    const result = await classifyPhoto(img);

    if (result.quality === "not_cat") {
      const isSpecific = !!(result.topClass && result.confidence > 0.5);
      setNotCatCopy(getNotCatCopy(result.topClass, result.confidence));
      setIsSpecificAnimal(isSpecific);
      setScreen("notcat");
      return;
    }

    // 4. Classification passed — compute pHash and search global DB
    setScreen("detecting");

    // Compute pHash from the canvas we already have
    const hash = await computePHash(getImageData(bc));
    const pb = getPocketBase();

    // Search PocketBase for similar cats by hash
    const allCats = await pb.collection("cats").getFullList({ fields: "id,name,hash,photoCount" });
    const candidates: MatchCandidate[] = allCats
      .filter((c: any) => c.hash && c.hash.length === 16)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        similarity: similarity(hash, c.hash),
        photoCount: c.photoCount || 0,
      }))
      .filter((c: MatchCandidate) => c.similarity > 60)
      .sort((a: MatchCandidate, b: MatchCandidate) => b.similarity - a.similarity)
      .slice(0, 5);

    // Store hash for later save
    pendingBlobRef.current = blob;
    pendingThumbBlobRef.current = thumbBlob;
    // Also store hash
    (pendingBlobRef as any).hash = hash;

    if (candidates.length > 0) {
      setMatchCandidates(candidates);
      setScreen("matching");
    } else {
      // No matches — create new cat directly
      await saveCat(null);
    }
  }

  async function saveCat(existingCatId: string | null = null) {
    const blob = pendingBlobRef.current;
    const thumbBlob = pendingThumbBlobRef.current;
    if (!blob || !thumbBlob) return;

    const hash = (pendingBlobRef as any).hash || "";
    const pb = getPocketBase();

    let catId = existingCatId;

    if (!catId) {
      // New cat
      const name = generateCatName();
      const cat = await pb.collection("cats").create({
        name,
        hash,
        photoCount: 1,
        discoveredBy: pb.authStore.record?.id,
      });
      catId = cat.id;
    } else {
      // Existing cat — update photo count
      const cat = await pb.collection("cats").getOne(catId) as any;
      await pb.collection("cats").update(catId, {
        photoCount: (cat.photoCount || 0) + 1,
        hash, // Update hash with latest photo's hash
      });
    }

    const form = new FormData();
    form.append("cat", catId!);
    form.append("user", pb.authStore.record?.id || "");
    form.append("photo", new File([blob], "photo.webp", { type: "image/webp" }));
    form.append("thumb", new File([thumbBlob], "thumb.webp", { type: "image/webp" }));
    form.append("phash", hash);
    await pb.collection("photos").create(form);

    // Award points
    const userId = pb.authStore.record?.id;
    if (userId) {
      const user = await pb.collection("users").getOne(userId) as any;
      const points = existingCatId ? 10 : 50; // +10 sighting, +50 discovery
      await pb.collection("users").update(userId, {
        score: (user.score || 0) + points,
      });
    }

    setSavedCatId(catId);
    setScreen("saved");
  }

  function resetCapture() {
    setScreen("camera");
    setPreviewUrl(null);
    pendingBlobRef.current = null;
    pendingThumbBlobRef.current = null;
  }

  // ── Render: Camera ──

  if (screen === "camera" || screen === "saved") {
    return (
      <div className="py-4 space-y-4">
        {screen === "saved" && savedCatId && <SavedScreen catId={savedCatId} photoUrl={previewUrl!} />}

        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Atrapar</h1>
        </div>

        {!previewUrl ? (
          <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-catdex-border">
            {!stream && !cameraError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-6 bg-[#1a1a1a]">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="text-sm text-white/50 text-center">Encuentra a tu gato salvaje</p>
                {isCameraAvailable() && (
                  <button onClick={startCamera} className="btn-pokedex flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Abrir cámara
                  </button>
                )}
                <button onClick={() => fileInputRef.current?.click()} className="btn-pokedex-secondary flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Subir foto
                </button>
              </div>
            ) : stream ? (
              <div className="relative w-full h-full">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {/* Corner brackets */}
                <div className="absolute inset-4 pointer-events-none">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-white/30" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M0 20V0h20" /><path d="M80 0h20v20" />
                    <path d="M100 80v20H80" /><path d="M20 100H0V80" />
                  </svg>
                </div>
                {/* Stable pill */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#6ABF95] rounded-full">
                  <span className="text-white text-xs font-semibold">Estable</span>
                </div>
                {/* Capture button */}
                <button
                  onClick={doCapture}
                  disabled={capturing}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-[5px] border-[#FC791A] active:scale-90 transition-transform disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-6 bg-[#1a1a1a]">
                <p className="text-sm text-white/50">Cámara no disponible</p>
                <button onClick={() => fileInputRef.current?.click()} className="btn-pokedex-secondary">
                  <Upload className="h-4 w-4" /> Subir foto
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-catdex-border">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            {capturing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#FC791A] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />
      </div>
    );
  }

  // ── Render: Blur / Detecting / NotCat overlays ──

  return (
    <>
      {/* Camera background */}
      <div className="absolute inset-0 bg-black" />

      {screen === "blur" && (
        <BlurCheckScreen
          title={blurCopy.title}
          subtitle={blurCopy.subtitle}
          photoUrl={previewUrl!}
          onRetry={resetCapture}
          onClose={resetCapture}
        />
      )}

      {screen === "detecting" && <DetectingScreen photoUrl={previewUrl!} />}

      {screen === "notcat" && (
        <NotCatScreen
          title={notCatCopy.title}
          subtitle={notCatCopy.subtitle}
          isSpecific={isSpecificAnimal}
          photoUrl={previewUrl!}
          onRetry={resetCapture}
          onUseAnyway={() => saveCat(null)}
          onClose={resetCapture}
        />
      )}

      {screen === "matching" && (
        <div className="fixed inset-0 z-50 bg-catdex-cream flex flex-col animate-pop-in">
          <div className="p-4 border-b-2 border-catdex-border flex items-center gap-3">
            <button onClick={resetCapture} className="btn-pokedex-secondary text-xs px-3 py-1.5">Cancelar</button>
            <h2 className="text-lg font-bold flex-1">¿Es uno de estos?</h2>
            <button onClick={() => saveCat(null)} className="btn-pokedex text-xs px-3 py-1.5">Nuevo gato</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {matchCandidates.map(c => (
              <button
                key={c.id}
                onClick={() => saveCat(c.id)}
                className="w-full card-pokedex p-3 flex items-center gap-3 text-left active:scale-[0.99]"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-catdex-text-muted">{c.photoCount} fotos · {c.similarity.toFixed(0)}% match</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-catdex-orange/10 flex items-center justify-center text-sm font-bold text-catdex-orange">
                  {c.similarity.toFixed(0)}%
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
