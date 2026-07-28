// Image normalization: resize + WebP conversion with JPEG fallback

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

  // Resize to max 1920x1080 preserving aspect ratio
  const MAX_W = 1920;
  const MAX_H = 1080;
  let { width, height } = img;
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

  // Thumbnail 256x256
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 256;
  thumbCanvas.height = 256;
  const thumbCtx = thumbCanvas.getContext("2d")!;
  thumbCtx.drawImage(img, 0, 0, 256, 256);
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
