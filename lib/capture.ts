import { computePHash, similarity } from "./phash";
import { getImageData } from "./image";

export const HIGH_SUGGESTION = 85;
export const LOW_SUGGESTION = 60;

export async function computeHashFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const imageData = getImageData(canvas);
  return computePHash(imageData);
}
