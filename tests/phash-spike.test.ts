/**
 * Spike pHash — validación de eficacia del algoritmo perceptual hash
 * para re-identificación de gatos en fotos reales.
 *
 * Ejecutar: npx tsx tests/phash-spike.test.ts
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

// ============================================================
// pHash implementation (same algorithm as lib/phash.ts, but Node-native)
// ============================================================

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
  const rows = matrix.map((row) => dct1D(row));
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

async function computePHash(imagePath: string): Promise<string> {
  // Load image, resize to 32x32, extract raw grayscale pixels
  const { data, info } = await sharp(imagePath)
    .resize(32, 32, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build 32x32 matrix
  const matrix: number[][] = [];
  for (let y = 0; y < 32; y++) {
    const row: number[] = [];
    for (let x = 0; x < 32; x++) {
      row.push(data[y * 32 + x]);
    }
    matrix.push(row);
  }

  // 2D DCT
  const dct = dct2D(matrix);

  // Extract top-left 8x8, skip DC [0,0]
  const coeffs: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (x === 0 && y === 0) continue;
      coeffs.push(dct[y][x]);
    }
  }

  // Median
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // 64-bit hash
  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (coeffs[i] >= median) {
      hash |= 1n << BigInt(63 - i);
    }
  }

  return hash.toString(16).padStart(16, "0");
}

function hammingDistance(hashA: string, hashB: string): number {
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

function similarity(hashA: string, hashB: string): number {
  return ((64 - hammingDistance(hashA, hashB)) / 64) * 100;
}

// ============================================================
// SPIKE
// ============================================================

const FIXTURES = path.join(__dirname, "fixtures");
const SAME_CAT = path.join(FIXTURES, "same-cat");
const DIFF_CAT = path.join(FIXTURES, "diff-cat");

interface CatPhoto {
  path: string;
  label: string; // filename
  hash?: string;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 CatDex pHash Spike Test");
  console.log("=".repeat(60));

  // Collect images
  const sameCatFiles = fs
    .readdirSync(SAME_CAT)
    .filter((f) => /\.(png|jpe?g|webp|heic)$/i.test(f))
    .map((f) => path.join(SAME_CAT, f));

  const diffCatFiles = fs
    .readdirSync(DIFF_CAT)
    .filter((f) => /\.(png|jpe?g|webp|heic)$/i.test(f))
    .map((f) => path.join(DIFF_CAT, f));

  console.log(`\n📸 same-cat: ${sameCatFiles.length} fotos`);
  console.log(`📸 diff-cat: ${diffCatFiles.length} fotos`);

  // Compute hashes
  console.log("\n🔢 Calculando hashes...");
  const sameCatPhotos: CatPhoto[] = [];
  for (const file of sameCatFiles) {
    const hash = await computePHash(file);
    sameCatPhotos.push({ path: file, label: path.basename(file), hash });
    process.stdout.write(".");
  }
  console.log(" ✓");

  const diffCatPhotos: CatPhoto[] = [];
  for (const file of diffCatFiles) {
    const hash = await computePHash(file);
    diffCatPhotos.push({ path: file, label: path.basename(file), hash });
    process.stdout.write(".");
  }
  console.log(" ✓");

  // --- Intra-class: same cat ---
  console.log("\n--- Same-cat (deberían ser similares) ---");
  const samePairs: number[] = [];
  for (let i = 0; i < sameCatPhotos.length; i++) {
    for (let j = i + 1; j < sameCatPhotos.length; j++) {
      const sim = similarity(sameCatPhotos[i].hash!, sameCatPhotos[j].hash!);
      samePairs.push(sim);
    }
  }
  samePairs.sort((a, b) => a - b);
  console.log(`  Pares: ${samePairs.length}`);
  console.log(`  Min: ${samePairs[0].toFixed(1)}%`);
  console.log(`  Q25: ${samePairs[Math.floor(samePairs.length * 0.25)].toFixed(1)}%`);
  console.log(`  Median: ${samePairs[Math.floor(samePairs.length * 0.5)].toFixed(1)}%`);
  console.log(`  Q75: ${samePairs[Math.floor(samePairs.length * 0.75)].toFixed(1)}%`);
  console.log(`  Max: ${samePairs[samePairs.length - 1].toFixed(1)}%`);
  console.log(`  Mean: ${(samePairs.reduce((a, b) => a + b, 0) / samePairs.length).toFixed(1)}%`);
  console.log("  Distribution:", samePairs.map((s) => s.toFixed(0) + "%").join(", "));

  // --- Inter-class: different cats ---
  console.log("\n--- Diff-cat (deberían ser distintos) ---");
  const diffPairs: number[] = [];
  for (let i = 0; i < diffCatPhotos.length; i++) {
    for (let j = i + 1; j < diffCatPhotos.length; j++) {
      const sim = similarity(diffCatPhotos[i].hash!, diffCatPhotos[j].hash!);
      diffPairs.push(sim);
    }
  }
  diffPairs.sort((a, b) => a - b);
  console.log(`  Pares: ${diffPairs.length}`);
  console.log(`  Min: ${diffPairs[0].toFixed(1)}%`);
  console.log(`  Q25: ${diffPairs[Math.floor(diffPairs.length * 0.25)].toFixed(1)}%`);
  console.log(`  Median: ${diffPairs[Math.floor(diffPairs.length * 0.5)].toFixed(1)}%`);
  console.log(`  Q75: ${diffPairs[Math.floor(diffPairs.length * 0.75)].toFixed(1)}%`);
  console.log(`  Max: ${diffPairs[diffPairs.length - 1].toFixed(1)}%`);
  console.log(`  Mean: ${(diffPairs.reduce((a, b) => a + b, 0) / diffPairs.length).toFixed(1)}%`);
  console.log("  Distribution:", diffPairs.map((s) => s.toFixed(0) + "%").join(", "));

  // --- Cross-class: same-cat vs diff-cat ---
  console.log("\n--- Cross-class (same vs diff) ---");
  const crossPairs: number[] = [];
  for (const same of sameCatPhotos) {
    for (const diff of diffCatPhotos) {
      const sim = similarity(same.hash!, diff.hash!);
      crossPairs.push(sim);
    }
  }
  crossPairs.sort((a, b) => a - b);
  console.log(`  Pares: ${crossPairs.length} (${sameCatPhotos.length} × ${diffCatPhotos.length})`);
  console.log(`  Min: ${crossPairs[0].toFixed(1)}%`);
  console.log(`  Q25: ${crossPairs[Math.floor(crossPairs.length * 0.25)].toFixed(1)}%`);
  console.log(`  Median: ${crossPairs[Math.floor(crossPairs.length * 0.5)].toFixed(1)}%`);
  console.log(`  Q75: ${crossPairs[Math.floor(crossPairs.length * 0.75)].toFixed(1)}%`);
  console.log(`  Max: ${crossPairs[crossPairs.length - 1].toFixed(1)}%`);
  console.log(`  Mean: ${(crossPairs.reduce((a, b) => a + b, 0) / crossPairs.length).toFixed(1)}%`);

  // --- TPR / FPR per threshold ---
  console.log("\n--- TPR vs FPR por umbral ---");
  const thresholds = [55, 60, 65, 70, 75, 80, 85, 90, 95];
  console.log("  Umbral |  TPR (mismo) |  FPR (distinto) |  F1  | ¿Útil?");
  console.log("  -------|-------------|-----------------|------|--------");

  for (const thresh of thresholds) {
    // TPR: % of same-cat pairs >= threshold
    const tp = samePairs.filter((s) => s >= thresh).length;
    const tpr = (tp / samePairs.length) * 100;

    // FPR: % of diff-cat pairs >= threshold
    const fp = diffPairs.filter((s) => s >= thresh).length;
    const fpr = (fp / diffPairs.length) * 100;

    // F1 = 2 * TP / (2*TP + FP + FN)
    const fn = samePairs.length - tp;
    const f1 = tp + fp + fn > 0 ? (2 * tp) / (2 * tp + fp + fn) : 0;

    const verdict =
      tpr > 70 && fpr < 20
        ? "✅ BUENO"
        : tpr > 50 && fpr < 30
          ? "⚠️ REGULAR"
          : "❌ MALO";

    console.log(
      `  ${thresh}%   |  ${tpr.toFixed(0)}% (${tp}/${samePairs.length})  |  ${fpr.toFixed(0)}% (${fp}/${diffPairs.length})  | ${f1.toFixed(2)} | ${verdict}`
    );
  }

  // --- Verdict ---
  console.log("\n" + "=".repeat(60));
  console.log("📊 VEREDICTO");

  const overlap = samePairs.filter((s) => {
    // How many same-pair scores fall below the best FPR-fixing threshold?
    return s < 75;
  }).length;

  const falseMatch = diffPairs.filter((s) => s >= 85).length;

  if (samePairs[samePairs.length - 1] < diffPairs[0]) {
    console.log("✅ PERFECTO: distribuciones no se solapan. pHash funciona.");
  } else if (overlap < samePairs.length * 0.3 && falseMatch < diffPairs.length * 0.1) {
    console.log(
      `⚠️ ACEPTABLE: ${overlap}/${samePairs.length} pares same-cat caen bajo el umbral, ${falseMatch} falsos positivos. pHash como PISTA con confirmación manual.`
    );
  } else {
    console.log(
      `❌ INSERVIBLE: ${overlap}/${samePairs.length} pares same-cat son indistinguibles de diff-cat. pHash NO sirve ni como pista.`
    );
  }

  console.log(
    "\n💡 Recomendación: pHash como SUGERENCIA (no autoridad). Usuario siempre confirma con 1 tap."
  );

  // Print hash table
  console.log("\n--- Tabla de hashes ---");
  console.log("\nSame-cat:");
  for (const p of sameCatPhotos) {
    console.log(`  ${p.hash}  ${p.label}`);
  }
  console.log("\nDiff-cat:");
  for (const p of diffCatPhotos) {
    console.log(`  ${p.hash}  ${p.label}`);
  }
}

main().catch(console.error);
