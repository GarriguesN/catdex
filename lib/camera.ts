// Camera: getUserMedia + fallback <input capture>

export async function openCamera(facing: "environment" | "user" = "environment"): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API not available");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch (err) {
    throw new Error(`Camera access denied: ${(err as Error).message}`);
  }
}

/** Best-effort torch toggle — silently ignored where unsupported. */
export async function setTorch(stream: MediaStream, on: boolean): Promise<void> {
  try {
    const track = stream.getVideoTracks()[0];
    await track?.applyConstraints({ advanced: [{ torch: on } as any] });
  } catch {
    /* not supported */
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
