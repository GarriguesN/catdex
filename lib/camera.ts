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

/** Digital zoom: crop the center region of the frame at 1/zoom size, then
 * upscale it back to full resolution — matches what the zoomed CSS preview
 * shows the user, since native track-level zoom isn't reliably supported
 * across browsers/devices. */
export function captureFrame(
  video: HTMLVideoElement,
  zoom: number = 1
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext("2d")!;
  if (zoom <= 1) {
    ctx.drawImage(video, 0, 0);
  } else {
    const cropW = vw / zoom;
    const cropH = vh / zoom;
    const cropX = (vw - cropW) / 2;
    const cropY = (vh - cropH) / 2;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, vw, vh);
  }
  return canvas;
}

export function isCameraAvailable(): boolean {
  return !!navigator.mediaDevices?.getUserMedia;
}
