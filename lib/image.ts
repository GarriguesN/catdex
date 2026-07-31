// Image normalization: resize + WebP conversion with JPEG fallback
import { parse } from "exifr";

export async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function normalizePhoto(file: File): Promise<{
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
}> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");

  // EXIF orientation: browsers auto-correct orientation in <img> + drawImage()
  // since ~2020. The dimensions may need swapping for rotated images (orient 5-8).
  const orientation = await parse(file, ["Orientation"]).catch(() => ({})) as any;
  const orient = orientation?.Orientation || 1;
  const swapDimensions = orient >= 5 && orient <= 8;

  let { width, height } = img;

  // Resize to max 1920x1080 preserving aspect ratio
  const MAX_W = swapDimensions ? 1080 : 1920;
  const MAX_H = swapDimensions ? 1920 : 1080;
  if (width > MAX_W || height > MAX_H) {
    const ratio = Math.min(MAX_W / width, MAX_H / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP first (~300KB), fallback JPEG if browser silently returns PNG
  let blob = await canvasToBlob(canvas, "image/webp", 0.8);
  if (!blob || blob.type !== "image/webp") {
    console.warn("WebP not supported, fallback to JPEG");
    blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
  }

  // Thumbnail 256x256 — center-crop to a square first so non-square photos
  // aren't squished to fit, then resize the crop into the canvas.
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 256;
  thumbCanvas.height = 256;
  const thumbCtx = thumbCanvas.getContext("2d")!;
  const cropSize = Math.min(img.width, img.height);
  const cropX = (img.width - cropSize) / 2;
  const cropY = (img.height - cropSize) / 2;
  thumbCtx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, 256, 256);
  let thumbBlob = await canvasToBlob(thumbCanvas, "image/webp", 0.7);
  if (!thumbBlob || thumbBlob.type !== "image/webp") {
    thumbBlob = await canvasToBlob(thumbCanvas, "image/jpeg", 0.7);
  }

  return { blob, thumbBlob, width, height };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b!),
      mimeType,
      quality
    );
  });
}

export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d")!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Laplacian variance blur detection — classic CV technique.
 * Lower variance = blurrier image. No ML, runs in <5ms on a canvas.
 *
 * Threshold: ~100 (calibrate with real photos). <100 = blurry.
 */
export function blurScore(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width] -
        4 * gray[idx];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean; // variance: lower = blurrier
}
