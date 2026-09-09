// On-device inference for the leaf scanner: onnxruntime-web running the
// quantized MobileNetV2 in public/models/leaf-v1/. This is why the scanner
// works on a Render free-tier backend at all -- see the OOM history recorded
// in supabase/migrations/20260908_01_knowledge_rag.sql, where an 80 MB model
// killed the 512 MB worker on first use. Nothing here calls the network past
// the model's own asset load.
//
// The model is the fp32 graph (9.2 MB), not the int8 build (2.7 MB): the
// onnx-community int8 quantisation of this MobileNetV2 is broken -- ~0/10 on
// PlantVillage test images, collapsing to "Healthy Bell Pepper" / "Healthy
// Corn" -- while fp32 scores 10/10. See scripts/prepare_leaf_model.py.
//
// A note on download size, so it isn't rediscovered the hard way: the ONNX
// Runtime WASM binary Vite bundles for this (ort-wasm-simd-threaded.wasm,
// under dist/assets/ after a build) is ~14 MB -- still bigger than the 9.2 MB
// model it runs. That's the runtime (shared by any future ONNX model this
// app adds), not the model, and the browser caches it indefinitely after
// first load (Vite fingerprints the filename), but it is a real first-visit
// cost on the patchy rural connections this app targets. Flagged, not
// solved, here.

import * as ort from 'onnxruntime-web/wasm';

// public/ is served as static files, not passed through Vite's module graph
// — fetched at runtime by URL, like cam_weights.bin below, rather than
// imported as a module (a relative import reaching into public/ would try to
// bundle it from outside src/, which is not what public/ is for).
//
// Deliberately NOT setting env.wasm.wasmPaths here. onnxruntime-web's ESM
// build locates its .wasm/.mjs via import.meta.url, which Vite's bundler
// resolves and copies into dist/assets/ (hashed, immutably cacheable) at
// build time -- no CDN involved either way. An earlier version of this file
// self-hosted a second copy under public/ort/ and pointed wasmPaths at it,
// on the assumption that was needed to avoid a CDN dependency; it wasn't --
// Vite had already bundled its own copy from node_modules regardless, so the
// app was shipping the ~14 MB WASM runtime TWICE (28 MB total). Confirmed via
// `npm run build` + inspecting dist/. Let Vite's default resolution own it.
ort.env.wasm.numThreads = 1; // avoids requiring crossOriginIsolated (COOP/COEP); see below

const MODEL_URL = '/models/leaf-v1/model.onnx';
const CAM_WEIGHTS_URL = '/models/leaf-v1/cam_weights.bin';
const LABELS_URL = '/models/leaf-v1/labels.json';
const NUM_CHANNELS = 1280;
const FEATURE_GRID = 7; // 7x7 spatial map at the pre-pool layer

// The int8 graph's second output -- the pre-GlobalAveragePool feature map --
// named for the tensor it comes from. Must match scripts/prepare_leaf_model.py's
// FEATURE_TENSOR constant; if the model is regenerated with a different graph
// this name has to move with it.
const FEATURE_OUTPUT_NAME = '/mobilenet_v2/conv_1x1/activation/Clip_output_0';

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let camWeightsPromise: Promise<Float32Array> | null = null;
let labelsPromise: Promise<string[]> | null = null;

/** Lazy singleton, mirroring the memoized-client pattern in src/lib/saath/client.ts. */
function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
    });
  }
  return sessionPromise;
}

async function getCamWeights(): Promise<Float32Array> {
  if (!camWeightsPromise) {
    camWeightsPromise = fetch(CAM_WEIGHTS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load CAM weights: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => new Float32Array(buf));
  }
  return camWeightsPromise;
}

async function getLabels(): Promise<string[]> {
  if (!labelsPromise) {
    labelsPromise = fetch(LABELS_URL).then((r) => {
      if (!r.ok) throw new Error(`Failed to load labels: HTTP ${r.status}`);
      return r.json() as Promise<string[]>;
    });
  }
  return labelsPromise;
}

/** Preload the model, CAM weights and labels, e.g. when the scan page mounts. */
export function preloadLeafModel(): void {
  void getSession();
  void getCamWeights();
  void getLabels();
}

export interface ClassScore {
  classId: number;
  label: string;
  confidence: number;
}

export interface LeafScanRawResult {
  /** Top-3 predictions from a full 38-class softmax, highest first. The model
   *  identifies the plant from the photo, so every class is in contention —
   *  see src/lib/leafScan/classes.ts for the limitation that carries. */
  top3: ClassScore[];
  /** [7,7] class activation map for the top prediction, values in [0,1]. */
  cam: Float32Array;
}

/**
 * Run inference over all 38 classes and compute the exact CAM for the top
 * prediction.
 *
 * MobileNetV2ForImageClassification is conv features -> GlobalAveragePool ->
 * Linear, which is precisely the architecture class activation mapping (Zhou
 * et al. 2016) was defined for: CAM_c(y,x) = sum_k W[c,k] * A[k,y,x]. That
 * makes this exact from one forward pass, with no gradients and no
 * approximation — unlike Grad-CAM on architectures with a deeper post-conv
 * head, where the weighting has to be estimated rather than read directly off
 * the classifier.
 */
export async function runLeafScan(image: Float32Array): Promise<LeafScanRawResult> {
  const [session, camWeights, labels] = await Promise.all([
    getSession(),
    getCamWeights(),
    getLabels(),
  ]);

  const input = new ort.Tensor('float32', image, [1, 3, 224, 224]);
  const outputs = await session.run({ pixel_values: input });

  const logits = outputs.logits.data as Float32Array; // [38]
  const featureMap = outputs[FEATURE_OUTPUT_NAME]?.data as Float32Array | undefined; // [1280*7*7]
  if (!featureMap) {
    throw new Error(
      `Model output is missing ${FEATURE_OUTPUT_NAME} — was the model rebuilt without ` +
        'scripts/prepare_leaf_model.py\'s feature-output patch?',
    );
  }

  // Full 38-class softmax: the model identifies the plant from the photo, so
  // every class competes. The confidence threshold (threshold.ts) is the only
  // gate now; classes.ts documents the "confident label for an unknown plant"
  // failure this reintroduces and how the UI surfaces it.
  const n = logits.length;
  let maxLogit = -Infinity;
  for (let i = 0; i < n; i++) if (logits[i] > maxLogit) maxLogit = logits[i];
  let sumExp = 0;
  const exps = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    exps[i] = Math.exp(logits[i] - maxLogit);
    sumExp += exps[i];
  }
  const scored: ClassScore[] = Array.from({ length: n }, (_, classId) => ({
    classId,
    label: labels[classId] as string,
    confidence: exps[classId] / sumExp,
  })).sort((a, b) => b.confidence - a.confidence);

  const top3 = scored.slice(0, 3);
  const cam = computeCam(featureMap, camWeights, top3[0].classId);

  return { top3, cam };
}

function computeCam(
  featureMap: Float32Array,
  camWeights: Float32Array,
  classId: number,
): Float32Array {
  const grid = FEATURE_GRID * FEATURE_GRID; // 49
  const weightsOffset = classId * NUM_CHANNELS;
  const cam = new Float32Array(grid);

  for (let k = 0; k < NUM_CHANNELS; k++) {
    const w = camWeights[weightsOffset + k];
    if (w === 0) continue;
    const channelOffset = k * grid;
    for (let p = 0; p < grid; p++) {
      cam[p] += w * featureMap[channelOffset + p];
    }
  }

  // ReLU (CAM is only meaningful where it supports the class, per Zhou et
  // al.) then normalize to [0,1] for rendering.
  let max = 0;
  for (let p = 0; p < grid; p++) {
    if (cam[p] < 0) cam[p] = 0;
    if (cam[p] > max) max = cam[p];
  }
  if (max > 0) {
    for (let p = 0; p < grid; p++) cam[p] /= max;
  }
  return cam;
}

/** All 38 PlantVillage labels, for anything that needs the full list outside a scan result. */
export const loadLeafScanLabels = getLabels;
