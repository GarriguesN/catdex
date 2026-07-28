"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Minus, Plus, RotateCcw } from "lucide-react";

interface CropScreenProps {
  photoUrl: string;
  onConfirm: (blob: Blob) => void;
  onBack: () => void;
}

const FRAME_ASPECT = 3 / 4; // width / height — portrait crop like the reference
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/** Manual crop: fixed portrait frame with grid + handles, pan by drag, zoom −/+. */
export function CropScreen({ photoUrl, onConfirm, onBack }: CropScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const clampOffset = useCallback(
    (x: number, y: number, z: number) => {
      // Keep the image covering the frame as much as possible
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img || !img.naturalWidth) return { x, y };
      const frame = frameRect(container);
      const base = containFit(img.naturalWidth, img.naturalHeight, frame.w, frame.h);
      const w = base.w * z;
      const h = base.h * z;
      const maxX = Math.max((w - frame.w) / 2, 0) + frame.w * 0.25;
      const maxY = Math.max((h - frame.h) / 2, 0) + frame.h * 0.25;
      return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    },
    []
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const next = clampOffset(d.baseX + (e.clientX - d.startX), d.baseY + (e.clientY - d.startY), zoom);
    setOffset(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  function changeZoom(delta: number) {
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(2)));
      setOffset((o) => clampOffset(o.x, o.y, next));
      return next;
    });
  }

  function reset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    reset();
  }, [photoUrl]);

  async function confirm() {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || confirming) return;
    setConfirming(true);

    const frame = frameRect(container);
    const base = containFit(img.naturalWidth, img.naturalHeight, frame.w, frame.h);

    // Displayed image rect (in frame coordinate space, origin = frame top-left)
    const dispW = base.w * zoom;
    const dispH = base.h * zoom;
    const dispX = frame.w / 2 + offset.x - dispW / 2;
    const dispY = frame.h / 2 + offset.y - dispH / 2;

    // Map frame → natural pixels
    const scale = img.naturalWidth / dispW;
    const sx = (0 - dispX) * scale;
    const sy = (0 - dispY) * scale;
    const sw = frame.w * scale;
    const sh = frame.h * scale;

    const outW = 1080;
    const outH = Math.round(outW / FRAME_ASPECT);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
    onConfirm(blob);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#211F1C] flex flex-col select-none">
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowHelp((s) => !s)}
          aria-label="Ayuda"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 bg-white/10"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      {showHelp && (
        <p className="relative z-10 text-center text-xs text-white/70 px-8 mt-2 animate-fade-up">
          Arrastra la foto para encuadrar al gato y ajusta el zoom. El recorte se guardará en tu
          colección.
        </p>
      )}

      {/* Crop area */}
      <div
        ref={containerRef}
        className="relative flex-1 mx-6 my-4 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Photo — transformed behind a fixed frame */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={photoUrl}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            style={{
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transition: dragRef.current ? "none" : "transform 0.15s ease-out",
            }}
          />
        </div>

        {/* Orange frame + rule-of-thirds grid + handles */}
        <div className="absolute inset-0 pointer-events-none border-2 border-catdex-orange rounded-sm">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/25" />
            ))}
          </div>
          {/* Corner + edge handles */}
          {[
            "-top-1.5 -left-1.5",
            "-top-1.5 -right-1.5",
            "-bottom-1.5 -left-1.5",
            "-bottom-1.5 -right-1.5",
            "-top-1.5 left-1/2 -translate-x-1/2",
            "-bottom-1.5 left-1/2 -translate-x-1/2",
            "top-1/2 -left-1.5 -translate-y-1/2",
            "top-1/2 -right-1.5 -translate-y-1/2",
          ].map((pos) => (
            <span
              key={pos}
              className={`absolute ${pos} w-3 h-3 rounded-full bg-white border-2 border-catdex-orange`}
            />
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="relative z-10 flex items-center justify-center gap-4 px-6 mb-4">
        <span className="text-sm font-medium text-white/80 mr-1">Zoom</span>
        <button
          onClick={() => changeZoom(-0.25)}
          aria-label="Alejar"
          className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          onClick={() => changeZoom(0.25)}
          aria-label="Acercar"
          className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          onClick={reset}
          aria-label="Restablecer"
          className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {/* Confirm */}
      <div className="relative z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button onClick={confirm} disabled={confirming} className="btn-primary w-full">
          {confirming ? "Recortando…" : "Confirmar recorte"}
        </button>
      </div>
    </div>
  );
}

function frameRect(container: HTMLDivElement) {
  return { w: container.clientWidth, h: container.clientHeight };
}

function containFit(natW: number, natH: number, boxW: number, boxH: number) {
  const ratio = Math.min(boxW / natW, boxH / natH);
  return { w: natW * ratio, h: natH * ratio };
}
