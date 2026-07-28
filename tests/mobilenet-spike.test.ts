/**
 * Spike 2 — MobileNet embeddings para re-identificación de gatos
 *
 * Hipótesis: MobileNet (entrenado en ImageNet) captura color/patrón/textura
 * de forma invariante a pose, permitiendo distinguir "gato naranja rayado"
 * de "gato gris atigrado" mediante similitud coseno de embeddings.
 *
 * Ejecutar: npx tsx tests/mobilenet-spike.test.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as tf from "@tensorflow/tfjs-node";
import * as mobilenet from "@tensorflow-models/mobilenet";
import sharp from "sharp";

// ============================================================
// Helpers
// ============================================================

async function loadImageAsTensor(imagePath: string): Promise<tf.Tensor3D> {
  // Load with sharp, convert to raw RGB buffer
  const { data, info } = await sharp(imagePath)
    .resize(224, 224, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert to tf.Tensor3D [224, 224, 3] normalized to [-1, 1]
  const floatData = new Float32Array(info.width * info.height * 3);
  for (let i = 0; i < data.length; i++) {
    floatData[i] = (data[i] / 127.5) - 1;
  }
  return tf.tensor3d(floatData, [info.height, info.width, 3]);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================
// Main
// ============================================================

const FIXTURES = path.join(__dirname, "fixtures");
const SAME_CAT = path.join(FIXTURES, "same-cat");
const DIFF_CAT = path.join(FIXTURES, "diff-cat");

interface EmbeddingEntry {
  label: string;
  embedding: Float32Array;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 Spike 2 — MobileNet v2 Embeddings");
  console.log("=".repeat(60));

  // Collect images
  const sameCatFiles = fs
    .readdirSync(SAME_CAT)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .map((f) => path.join(SAME_CAT, f));

  const diffCatFiles = fs
    .readdirSync(DIFF_CAT)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .map((f) => path.join(DIFF_CAT, f));

  console.log(`\n📸 same-cat: ${sameCatFiles.length} fotos`);
  console.log(`📸 diff-cat: ${diffCatFiles.length} fotos`);

  // Load MobileNet
  console.log("\n🔧 Cargando MobileNet v2 (alpha=0.50, modelo ligero)...");
  const model = await mobilenet.load({
    version: 2,
    alpha: 0.5,
  });
  console.log("   ✓ Modelo cargado");

  // Compute embeddings
  console.log("\n🔢 Extrayendo embeddings...");
  const sameCatEntries: EmbeddingEntry[] = [];
  for (const file of sameCatFiles) {
    const tensor = await loadImageAsTensor(file);
    const activation = model.infer(tensor, true) as tf.Tensor;
    const data = await activation.data();
    sameCatEntries.push({
      label: path.basename(file),
      embedding: new Float32Array(data),
    });
    activation.dispose();
    tensor.dispose();
    process.stdout.write("s");
  }
  console.log(" ✓");

  const diffCatEntries: EmbeddingEntry[] = [];
  for (const file of diffCatFiles) {
    const tensor = await loadImageAsTensor(file);
    const activation = model.infer(tensor, true) as tf.Tensor;
    const data = await activation.data();
    diffCatEntries.push({
      label: path.basename(file),
      embedding: new Float32Array(data),
    });
    activation.dispose();
    tensor.dispose();
    process.stdout.write("d");
  }
  console.log(" ✓");

  const embeddingDim = sameCatEntries[0].embedding.length;
  console.log(`   Dimensión del embedding: ${embeddingDim}`);

  // ── Same-cat similarities ──
  console.log("\n--- Same-cat (deberían ser SIMILARES) ---");
  const samePairs: number[] = [];
  for (let i = 0; i < sameCatEntries.length; i++) {
    for (let j = i + 1; j < sameCatEntries.length; j++) {
      const sim = cosineSimilarity(
        sameCatEntries[i].embedding,
        sameCatEntries[j].embedding
      );
      samePairs.push(sim);
    }
  }
  samePairs.sort((a, b) => a - b);
  printStats("Same-cat", samePairs);

  // ── Diff-cat similarities ──
  console.log("\n--- Diff-cat (deberían ser DISTINTOS) ---");
  const diffPairs: number[] = [];
  for (let i = 0; i < diffCatEntries.length; i++) {
    for (let j = i + 1; j < diffCatEntries.length; j++) {
      const sim = cosineSimilarity(
        diffCatEntries[i].embedding,
        diffCatEntries[j].embedding
      );
      diffPairs.push(sim);
    }
  }
  diffPairs.sort((a, b) => a - b);
  printStats("Diff-cat", diffPairs);

  // ── Cross-class ──
  console.log("\n--- Cross-class (same vs diff) ---");
  const crossPairs: number[] = [];
  for (const same of sameCatEntries) {
    for (const diff of diffCatEntries) {
      const sim = cosineSimilarity(same.embedding, diff.embedding);
      crossPairs.push(sim);
    }
  }
  crossPairs.sort((a, b) => a - b);
  printStats("Cross-class", crossPairs);

  // ── Separation analysis ──
  console.log("\n--- Análisis de separación ---");
  const sameMean = samePairs.reduce((a, b) => a + b, 0) / samePairs.length;
  const diffMean = diffPairs.reduce((a, b) => a + b, 0) / diffPairs.length;
  const separation = sameMean - diffMean;
  const sameStd = Math.sqrt(
    samePairs.reduce((s, v) => s + (v - sameMean) ** 2, 0) / samePairs.length
  );
  const diffStd = Math.sqrt(
    diffPairs.reduce((s, v) => s + (v - diffMean) ** 2, 0) / diffPairs.length
  );

  console.log(`  Same-cat  mean: ${(sameMean * 100).toFixed(1)}%  std: ${(sameStd * 100).toFixed(1)}%`);
  console.log(`  Diff-cat  mean: ${(diffMean * 100).toFixed(1)}%  std: ${(diffStd * 100).toFixed(1)}%`);
  console.log(`  Separación:    ${(separation * 100).toFixed(1)}%`);
  console.log(`  Overlap:       ${sameMean - sameStd < diffMean + diffStd ? "SÍ ❌" : "NO ✅"}`);

  // ── TPR/FPR por umbral ──
  console.log("\n--- TPR vs FPR por umbral (coseno) ---");
  const thresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
  console.log("  Umbral |  TPR (mismo) |  FPR (distinto) |  F1  | ¿Útil?");
  console.log("  -------|-------------|-----------------|------|--------");

  for (const thresh of thresholds) {
    const tp = samePairs.filter((s) => s >= thresh).length;
    const tpr = (tp / samePairs.length) * 100;
    const fp = diffPairs.filter((s) => s >= thresh).length;
    const fpr = (fp / diffPairs.length) * 100;
    const fn = samePairs.length - tp;
    const f1 = tp + fp + fn > 0 ? (2 * tp) / (2 * tp + fp + fn) : 0;

    const verdict =
      tpr > 70 && fpr < 20
        ? "✅ BUENO"
        : tpr > 50 && fpr < 30
          ? "⚠️ REGULAR"
          : "❌ MALO";

    console.log(
      `  ${thresh.toFixed(2)} |  ${tpr.toFixed(0)}% (${tp}/${samePairs.length})  |  ${fpr.toFixed(0)}% (${fp}/${diffPairs.length})  | ${f1.toFixed(2)} | ${verdict}`
    );
  }

  // ── Verdict ──
  console.log("\n" + "=".repeat(60));
  console.log("📊 VEREDICTO SPIKE 2");

  if (separation > 0.15 && sameMean > 0.7) {
    console.log("✅ VIABLE: MobileNet embeddings separan razonablemente bien.");
    console.log("   Recomendación: implementar como sugerencia en v1.1.");
    console.log(
      `   Mejor umbral: ~${(sameMean - sameStd * 0.5).toFixed(2)} (balance TPR/FPR)`
    );
  } else if (separation > 0.05) {
    console.log("⚠️ MARGINAL: hay algo de señal pero con mucho overlap.");
    console.log("   Recomendación: filtrar por color dominante como primera pasada,");
    console.log("   MobileNet solo si el color coincide (reduce falsos positivos).");
  } else {
    console.log("❌ INSERVIBLE: MobileNet genérico (ImageNet) no distingue");
    console.log("   individuos de la misma especie. Igual que pHash.");
    console.log("   Hace falta modelo entrenado para re-id (Wildbook/HotSpotter),");
    console.log("   que no existe empaquetado para navegador.");
  }

  // Cleanup
  model.dispose();
}

function printStats(label: string, values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const pcts = values.map((v) => (v * 100).toFixed(0) + "%");
  console.log(`  ${label}:`);
  console.log(`    Pares: ${n}`);
  console.log(`    Min: ${(values[0] * 100).toFixed(1)}%  |  Max: ${(values[n - 1] * 100).toFixed(1)}%`);
  console.log(`    Q25: ${(values[Math.floor(n * 0.25)] * 100).toFixed(1)}%  |  Q75: ${(values[Math.floor(n * 0.75)] * 100).toFixed(1)}%`);
  console.log(`    Mediana: ${(values[Math.floor(n * 0.5)] * 100).toFixed(1)}%`);
  console.log(`    Media: ${(mean * 100).toFixed(1)}%`);
  console.log(`    Distribución: ${pcts.join(", ")}`);
}

main().catch(console.error);
