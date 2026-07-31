"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Zap, ZapOff, SwitchCamera, Camera, ZoomIn } from "lucide-react";
import clsx from "clsx";
import { normalizePhoto, blurScore, getImageData } from "@/lib/image";
import { openCamera, captureFrame, isCameraAvailable, setTorch } from "@/lib/camera";
import { generateCatName } from "@/lib/names";
import { getBlurCopy, getNotCatCopy, isKnownAnimal } from "@/lib/copy";
import { reverseGeocode } from "@/lib/geo";
import { classifyPhoto, preloadClassifier, type ClassificationResult } from "@/lib/classifier";
import { computePHash, similarity } from "@/lib/phash";
import { getPocketBase, isAbortError } from "@/lib/pocketbase";
import { playShutterSound } from "@/lib/sounds";
import { isDebugCameraEnabled } from "@/lib/debug-prefs";
import { CatPicker } from "@/components/CatPicker";
import { BlurCheckScreen } from "@/components/capture/BlurCheckScreen";
import { DetectingScreen } from "@/components/capture/DetectingScreen";
import { NotCatScreen } from "@/components/capture/NotCatScreen";
import { SavedScreen } from "@/components/capture/SavedScreen";

type Screen = "camera" | "blur" | "detecting" | "notcat" | "saved";

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_PRESETS = [1, 2, 3];

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function touchDistance(touches: React.TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

interface DebugInfo {
  size: string;
  blurScore: number;
  decision: string;
  classifier?: ClassificationResult;
}

export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasStream, setHasStream] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("camera");
  const [blurCopy, setBlurCopy] = useState({ title: "", subtitle: "" });
  const [notCatCopy, setNotCatCopy] = useState({ title: "", subtitle: "" });
  const [isSpecificAnimal, setIsSpecificAnimal] = useState(false);
  const [savedCatId, setSavedCatId] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const pendingBlobRef = useRef<Blob | null>(null);
  const pendingThumbBlobRef = useRef<Blob | null>(null);
  const pendingHashRef = useRef<string>("");
  const positionRef = useRef<{ lat: number; lng: number } | null>(null);
  const cityPromiseRef = useRef<Promise<string> | null>(null);
  const savingRef = useRef(false);
  const zoomRef = useRef(1);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    setDebugEnabled(isDebugCameraEnabled());
  }, []);

  // ── Camera lifecycle ──

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setHasStream(false);
  }, []);

  const startCamera = useCallback(
    async (facingMode: "environment" | "user" = "environment") => {
      stopCamera();
      setCameraError(false);
      try {
        const s = await openCamera(facingMode);
        streamRef.current = s;
        setHasStream(true);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        setCameraError(true);
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    if (isCameraAvailable()) startCamera(facing);

    // Warm up the detection model now, in the background — the first load
    // is ~20s of mostly main-thread work (download + WebGL shader compile).
    // Doing it here means it's done well before the user takes their first
    // photo, instead of freezing the "Detectando…" screen right after.
    preloadClassifier();

    // Grab position early (best effort) so saves carry GPS
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        positionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Resolve the city now so it's ready by save time — best-effort,
        // a failure just means the photo saves with city="".
        cityPromiseRef.current = reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    );

    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The <video> mounts after hasStream flips — re-attach the stream then
  useEffect(() => {
    if (hasStream && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [hasStream]);

  function flipCamera() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    setTorchOn(false);
    startCamera(next);
  }

  async function toggleTorch() {
    if (!streamRef.current) return;
    const next = !torchOn;
    setTorchOn(next);
    await setTorch(streamRef.current, next);
  }

  // ── Zoom: pinch gesture + cycling button ──

  function cycleZoom() {
    const next = ZOOM_PRESETS.find((p) => p > zoomRef.current + 0.05) ?? ZOOM_PRESETS[0];
    setZoom(next);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: touchDistance(e.touches), startZoom: zoomRef.current };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const scale = touchDistance(e.touches) / pinchRef.current.startDist;
      setZoom(clamp(pinchRef.current.startZoom * scale, ZOOM_MIN, ZOOM_MAX));
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  // ── Capture ──

  const doCapture = useCallback(async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    playShutterSound();
    try {
      const v = videoRef.current;
      console.log(
        `[camera] capturing frame: videoTime=${v.currentTime.toFixed(2)}s readyState=${v.readyState}` +
          ` paused=${v.paused} size=${v.videoWidth}x${v.videoHeight}`
      );
      const canvas = captureFrame(v, zoomRef.current);
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
      await processCapture(blob);
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  // ── Pipeline: normalize → blur check → coco-ssd detection → pHash + picker ──

  async function processCapture(file: Blob) {
    const captureId = Math.random().toString(36).slice(2, 8);
    console.log(`[capture:${captureId}] source blob: ${file.type}, ${file.size} bytes`);
    setDebugInfo(null);

    // 1. Normalize
    const { blob, thumbBlob } = await normalizePhoto(new File([file], "capture.jpg", { type: file.type || "image/jpeg" }));
    pendingBlobRef.current = blob;
    pendingThumbBlobRef.current = thumbBlob;
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    console.log(`[capture:${captureId}] normalized: ${blob.type}, ${blob.size} bytes`);

    // 2. Blur check
    const img = new Image();
    img.src = url;
    await new Promise((r) => (img.onload = r));
    const bc = document.createElement("canvas");
    bc.width = img.width;
    bc.height = img.height;
    bc.getContext("2d")!.drawImage(img, 0, 0);
    const imageData = getImageData(bc);
    const bv = blurScore(imageData);
    console.log(
      `[capture:${captureId}] ${img.width}x${img.height}, blurScore=${bv.toFixed(1)}` +
        ` (threshold 50), pixel-sample=${samplePixels(imageData)}`
    );

    if (bv < 50) {
      console.log(`[capture:${captureId}] rejected: blurry`);
      setBlurCopy(getBlurCopy());
      setDebugInfo({ size: `${img.width}x${img.height}`, blurScore: bv, decision: "blurry" });
      setScreen("blur");
      return;
    }

    // 3. coco-ssd cat-detection gate
    setScreen("detecting");
    const result = await classifyPhoto(img);
    console.log(`[capture:${captureId}] classifier result:`, result);

    if (result.quality === "not_cat") {
      console.log(`[capture:${captureId}] rejected: not_cat`);
      setNotCatCopy(getNotCatCopy(result.topClass, result.confidence));
      setIsSpecificAnimal(isKnownAnimal(result.topClass, result.confidence));
      setDebugInfo({ size: `${img.width}x${img.height}`, blurScore: bv, decision: "not_cat", classifier: result });
      setScreen("notcat");
      return;
    }

    console.log(`[capture:${captureId}] accepted, proceeding to pHash + picker`);
    setDebugInfo({ size: `${img.width}x${img.height}`, blurScore: bv, decision: result.quality, classifier: result });
    // 4. pHash + picker
    await finalizeCapture(imageData);
  }

  /** Cheap visual signature (avg RGB of a 5x5 grid) — logged to confirm each
   * capture is genuinely a new frame, not a stale/frozen one. */
  function samplePixels(imageData: ImageData): string {
    const { data, width, height } = imageData;
    const samples: number[] = [];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        const x = Math.floor((gx + 0.5) * (width / 5));
        const y = Math.floor((gy + 0.5) * (height / 5));
        const i = (y * width + x) * 4;
        samples.push(data[i], data[i + 1], data[i + 2]);
      }
    }
    return samples.join(",");
  }

  // ── pHash + picker (shared by the good path and "Usar de todas formas") ──

  async function finalizeCapture(imageData: ImageData) {
    setScreen("detecting");
    try {
      const hash = await computePHash(imageData);
      pendingHashRef.current = hash;

      const pb = getPocketBase();
      const myId = pb.authStore.record?.id || "";
      const allCats = await pb.collection("cats").getFullList({
        filter: `discoveredBy="${myId}"`,
        fields: "id,name,hash",
      });
      const scored = allCats
        .filter((cat: any) => cat.hash && cat.hash.length === 16)
        .map((cat: any) => ({ id: cat.id, sim: similarity(hash, cat.hash) }))
        .sort((a: any, b: any) => b.sim - a.sim);

      setSuggestedIds(scored.map((s: any) => s.id));
    } catch (err) {
      if (!isAbortError(err)) console.error("pHash/lookup failed:", err);
      setSuggestedIds([]);
    }
    setShowPicker(true);
  }

  async function handleUseAnyway() {
    if (!previewUrl) return;
    const img = new Image();
    img.src = previewUrl;
    await new Promise((r) => (img.onload = r));
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d")!.drawImage(img, 0, 0);
    await finalizeCapture(getImageData(c));
  }

  async function saveCat(existingCatId: string | null = null) {
    const blob = pendingBlobRef.current;
    const thumbBlob = pendingThumbBlobRef.current;
    // Ref check-and-set is synchronous, unlike `saving` state — guards against
    // a double-tap firing this twice before the first render with saving=true lands.
    if (!blob || !thumbBlob || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const captureStartedAt = Date.now();

    try {
      const hash = pendingHashRef.current;
      const pb = getPocketBase();

      let catId = existingCatId;

      if (!catId) {
        const name = generateCatName();
        // requestKey: null — PocketBase auto-cancels same-endpoint requests by
        // default; without this a second concurrent create() would abort this one.
        const cat = await pb.collection("cats").create(
          { name, hash, photoCount: 1, discoveredBy: pb.authStore.record?.id },
          { requestKey: null }
        );
        catId = cat.id;
      } else {
        const cat = (await pb.collection("cats").getOne(catId)) as any;
        await pb.collection("cats").update(
          catId,
          { photoCount: (cat.photoCount || 0) + 1, hash },
          { requestKey: null }
        );
      }

      const form = new FormData();
      form.append("cat", catId!);
      form.append("user", pb.authStore.record?.id || "");
      form.append("photo", new File([blob], "photo.webp", { type: blob.type }));
      form.append("thumb", new File([thumbBlob], "thumb.webp", { type: thumbBlob.type }));
      form.append("phash", hash);
      if (positionRef.current) {
        form.append("lat", String(positionRef.current.lat));
        form.append("lng", String(positionRef.current.lng));
        // Usually resolved long before the user reaches save; cap the wait
        // so a slow Nominatim can never hold the capture flow hostage.
        const city = await Promise.race([
          cityPromiseRef.current ?? Promise.resolve(""),
          new Promise<string>((r) => setTimeout(() => r(""), 3000)),
        ]);
        if (city) form.append("city", city);
      }
      await pb.collection("photos").create(form, { requestKey: null });

      // Best-effort: refresh score/streak in the authStore and check whether
      // this capture unlocked any new badge (the achievements hook runs
      // server-side in the same request as the photo create above) — never
      // block the "saved" screen on this, the photo is already safe.
      try {
        const userId = pb.authStore.record?.id;
        const [unlocked] = await Promise.all([
          pb.collection("achievements").getFullList({
            filter: `user="${userId}" && unlockedAt > ${captureStartedAt}`,
            fields: "badgeCode",
          }),
          pb.collection("users").authRefresh(),
        ]);
        setNewAchievements(unlocked.map((a: any) => a.badgeCode));
      } catch (err) {
        if (!isAbortError(err)) console.error("Post-save achievement check failed:", err);
      }

      stopCamera();
      setSavedCatId(catId);
      setScreen("saved");
    } catch (err) {
      console.error("Save failed:", err);
      alert("No se ha podido guardar. Inténtalo de nuevo.");
    }
    savingRef.current = false;
    setSaving(false);
  }

  function resetCapture() {
    console.log(`[camera] resetCapture: streamLive=${!!streamRef.current}`);
    setScreen("camera");
    setPreviewUrl(null);
    setShowPicker(false);
    setDebugInfo(null);
    pendingBlobRef.current = null;
    pendingThumbBlobRef.current = null;
    pendingHashRef.current = "";
    setNewAchievements([]);
    if (!streamRef.current && isCameraAvailable()) startCamera(facing);
  }

  // ── Render ──

  if (screen === "saved" && savedCatId) {
    return (
      <SavedScreen
        catId={savedCatId}
        photoUrl={previewUrl!}
        newAchievements={newAchievements}
        onContinue={resetCapture}
      />
    );
  }

  return (
    <>
      {/* Full-screen camera */}
      <div
        className="fixed inset-0 z-40 bg-black flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${zoom})` }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 bg-[#1a1a1a]">
            <Camera className="h-12 w-12 text-white/30" />
            <p className="text-sm text-white/50 text-center">
              {cameraError ? "Cámara no disponible" : "Encuentra a tu gato salvaje"}
            </p>
            {cameraError && isCameraAvailable() && (
              <button onClick={() => startCamera(facing)} className="btn-primary">
                Reintentar cámara
              </button>
            )}
          </div>
        )}

        {/* Top controls */}
        <div
          className="relative z-10 flex items-center justify-between px-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => {
              stopCamera();
              router.push("/");
            }}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {hasStream && (
            <span className="px-4 py-1.5 bg-[#3DBE7B] rounded-full text-white text-xs font-semibold shadow-soft">
              Estable
            </span>
          )}

          <button
            onClick={toggleTorch}
            aria-label={torchOn ? "Apagar flash" : "Encender flash"}
            className={clsx(
              "w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors",
              torchOn ? "bg-catdex-orange text-white" : "bg-black/30 text-white"
            )}
          >
            {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </button>
        </div>

        {/* Corner brackets */}
        {hasStream && (
          <div className="absolute inset-x-10 top-[18%] bottom-[26%] pointer-events-none">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-white/60" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M0 12V0h12" vectorEffect="non-scaling-stroke" strokeWidth="3" />
              <path d="M88 0h12v12" vectorEffect="non-scaling-stroke" strokeWidth="3" />
              <path d="M100 88v12H88" vectorEffect="non-scaling-stroke" strokeWidth="3" />
              <path d="M12 100H0V88" vectorEffect="non-scaling-stroke" strokeWidth="3" />
            </svg>
          </div>
        )}

        {/* Bottom controls */}
        <div
          className="relative z-10 mt-auto flex items-center justify-between px-10"
          style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={cycleZoom}
            aria-label="Cambiar zoom"
            className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white active:scale-90 transition-transform gap-0.5"
          >
            <ZoomIn className="h-4 w-4" />
            <span className="text-[0.6875rem] font-semibold leading-none">{zoom.toFixed(1)}×</span>
          </button>

          <button
            onClick={doCapture}
            disabled={!hasStream || capturing}
            aria-label="Capturar"
            className="w-[4.5rem] h-[4.5rem] rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          >
            <span className={clsx("w-14 h-14 rounded-full", capturing ? "bg-catdex-orange animate-pulse" : "bg-white")} />
          </button>

          <button
            onClick={flipCamera}
            aria-label="Girar cámara"
            className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <SwitchCamera className="h-5.5 w-5.5" />
          </button>
        </div>
      </div>

      {/* Pipeline overlays */}
      {screen === "blur" && (
        <BlurCheckScreen
          title={blurCopy.title}
          subtitle={blurCopy.subtitle}
          photoUrl={previewUrl!}
          onRetry={resetCapture}
          onClose={resetCapture}
        />
      )}

      {screen === "detecting" && !showPicker && <DetectingScreen photoUrl={previewUrl!} />}

      {screen === "notcat" && (
        <NotCatScreen
          title={notCatCopy.title}
          subtitle={notCatCopy.subtitle}
          isSpecific={isSpecificAnimal}
          photoUrl={previewUrl!}
          onRetry={resetCapture}
          onUseAnyway={handleUseAnyway}
          onClose={resetCapture}
        />
      )}

      {showPicker && (
        <CatPicker
          suggestedIds={suggestedIds}
          onSelect={(catId) => {
            setShowPicker(false);
            saveCat(catId);
          }}
          onCancel={resetCapture}
        />
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-catdex-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Debug overlay — settings > Modo debug */}
      {debugEnabled && debugInfo && (
        <div
          className="fixed left-3 right-3 z-[70] rounded-xl bg-black/75 backdrop-blur-sm px-3 py-2 text-white font-mono text-[0.6875rem] leading-relaxed"
          style={{ bottom: "max(10rem, calc(10rem + env(safe-area-inset-bottom)))" }}
        >
          <p>size={debugInfo.size} blur={debugInfo.blurScore.toFixed(1)} decision={debugInfo.decision}</p>
          {debugInfo.classifier && (
            <>
              <p>
                cat={debugInfo.classifier.isCat ? "sí" : "no"} confidence={debugInfo.classifier.confidence.toFixed(1)}%
                quality={debugInfo.classifier.quality}
              </p>
              {debugInfo.classifier.detections && debugInfo.classifier.detections.length > 0 && (
                <p className="truncate">
                  detections=
                  {debugInfo.classifier.detections.map((d) => `${d.class}(${d.score}%)`).join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
