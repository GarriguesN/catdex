// pHash implementation using DCT (Discrete Cosine Transform)
// 64-bit perceptual hash — pista, NO autoridad

function dct1D(arr: number[]): number[] {
  const N = arr.length;
  const result: number[] = new Array(N).fill(0);
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += arr[n] * Math.cos((Math.PI / N) * (n + 0.5) * k);
    }
    result[k] = sum;
  }
  return result;
}

function dct2D(matrix: number[][]): number[][] {
  const N = matrix.length;
  // 1D DCT on rows
  const rows = matrix.map((row) => dct1D(row));
  // 1D DCT on columns
  const result: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    const col = rows.map((row) => row[i]);
    const dctCol = dct1D(col);
    for (let j = 0; j < N; j++) {
      result[j][i] = dctCol[j];
    }
  }
  return result;
}

export async function computePHash(imageData: ImageData): Promise<string> {
  // Resize to 32x32 grayscale
  const small = resizeGrayscale(imageData, 32, 32);
  
  // Convert to 2D array
  const matrix: number[][] = [];
  for (let y = 0; y < 32; y++) {
    const row: number[] = [];
    for (let x = 0; x < 32; x++) {
      row.push(small[y * 32 + x]);
    }
    matrix.push(row);
  }

  // DCT 2D
  const dct = dct2D(matrix);

  // Extract top-left 8x8 (excluding DC at [0,0])
  const coeffs: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (x === 0 && y === 0) continue; // skip DC
      coeffs.push(dct[y][x]);
    }
  }

  // Median of coefficients
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Generate 64-bit hash
  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (coeffs[i] >= median) {
      hash |= 1n << BigInt(63 - i);
    }
  }

  // Return as hex string (16 chars)
  return hash.toString(16).padStart(16, "0");
}

export function hammingDistance(hashA: string, hashB: string): number {
  let a = BigInt("0x" + hashA);
  let b = BigInt("0x" + hashB);
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

export function similarity(hashA: string, hashB: string): number {
  const dist = hammingDistance(hashA, hashB);
  return ((64 - dist) / 64) * 100;
}

// Helper: resize image to target dimensions, return grayscale flat array
function resizeGrayscale(
  imageData: ImageData,
  targetW: number,
  targetH: number
): Float64Array {
  const { data, width, height } = imageData;
  const result = new Float64Array(targetW * targetH);
  const xRatio = width / targetW;
  const yRatio = height / targetH;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const idx = (srcY * width + srcX) * 4;
      // Grayscale: 0.299R + 0.587G + 0.114B
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      result[y * targetW + x] = gray;
    }
  }
  return result;
}
