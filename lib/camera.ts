// Camera: getUserMedia + fallback <input capture>

export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API not available");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch (err) {
    throw new Error(`Camera access denied: ${(err as Error).message}`);
  }
}

export function captureFrame(
  video: HTMLVideoElement
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return canvas;
}

export function isCameraAvailable(): boolean {
  return !!navigator.mediaDevices?.getUserMedia;
}
