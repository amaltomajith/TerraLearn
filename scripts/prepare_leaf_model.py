"""Build the browser-side leaf-scanner artifacts in public/models/leaf-v1/.

Run once (or whenever the upstream checkpoint changes):

    pip install onnx numpy          # dev-only; NOT a backend/requirements.txt dep
    python scripts/prepare_leaf_model.py

Why this script exists
----------------------
Inference runs on-device (planned_features.md sec.3: "export to ONNX/TFLite,
quantized, for on-device inference"), because the Render free tier is 512 MB and
already OOM-died once loading torch + an 80 MB model -- see the header of
supabase/migrations/20260908_01_knowledge_rag.sql. So the model has to be small
enough to ship to a phone: we use the int8 build (2.7 MB).

sec.3 also makes an explainability overlay non-negotiable. MobileNetV2 is
conv -> GlobalAveragePool -> Linear, which is exactly the architecture class
activation mapping (CAM) was defined for, so a plain CAM is *exact* here and
needs only a forward pass -- no gradients, hence no Python at inference time:

    CAM_c(y,x) = sum_k  classifier.weight[c,k] * A[k,y,x]

To compute that in the browser we need two things the stock export does not give
us: the pre-pool feature map A, and the classifier weight matrix. This script
produces both.

Outputs
-------
public/models/leaf-v1/
    model.onnx        int8 graph, patched to emit the feature map as a 2nd output
    cam_weights.bin   classifier.weight, [38, 1280] float32, row-major
    labels.json       id2label from the upstream config.json

A note on where cam_weights comes from
--------------------------------------
The int8 graph stores the classifier as `classifier.weight_quantized`
([1280, 38] int8, transposed, with a separate scale/zero-point). Rather than
dequantize and transpose that, we read `classifier.weight` ([38, 1280] float32)
straight out of the fp32 graph. The two differ by quantization error only, and
CAM is a visualisation of *where* the model looked, not a number we report -- so
the fp32 weights are the better choice and the mismatch is immaterial.
"""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper

REPO = "onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX"
BASE = f"https://huggingface.co/{REPO}/resolve/main/"

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "models" / "leaf-v1"
CACHE = ROOT / ".cache" / "leaf-model"

# The float tensor feeding GlobalAveragePool -- i.e. the [1, 1280, 7, 7] feature
# map. Verified present in BOTH the fp32 and int8 graphs: int8 quantisation
# rescales and re-adds the bias before the Clip, so this stays float even in the
# quantised build. If a future upstream re-export changes this name the script
# fails loudly below rather than silently producing a broken overlay.
FEATURE_TENSOR = "/mobilenet_v2/conv_1x1/activation/Clip_output_0"
CLASSIFIER_WEIGHT = "classifier.weight"

NUM_CLASSES = 38
NUM_CHANNELS = 1280


def fetch(remote: str, local: Path) -> Path:
    local.parent.mkdir(parents=True, exist_ok=True)
    if local.exists() and local.stat().st_size > 0:
        print(f"  cached  {local.name} ({local.stat().st_size:,} bytes)")
        return local
    print(f"  fetching {remote} ...")
    urllib.request.urlretrieve(BASE + remote, local)
    print(f"  got     {local.name} ({local.stat().st_size:,} bytes)")
    return local


def patch_feature_output(model: onnx.ModelProto) -> onnx.ModelProto:
    """Append the pre-pool feature map to the graph's outputs."""
    produced = {out for node in model.graph.node for out in node.output}
    if FEATURE_TENSOR not in produced:
        raise SystemExit(
            f"Feature tensor {FEATURE_TENSOR!r} is not produced by this graph.\n"
            "The upstream export changed. Re-inspect the node feeding "
            "GlobalAveragePool and update FEATURE_TENSOR."
        )

    if any(o.name == FEATURE_TENSOR for o in model.graph.output):
        print("  feature map already an output; leaving as-is")
        return model

    # float32, [batch, 1280, 7, 7]
    value_info = onnx.helper.make_tensor_value_info(
        FEATURE_TENSOR,
        onnx.TensorProto.FLOAT,
        ["batch_size", NUM_CHANNELS, 7, 7],
    )
    model.graph.output.append(value_info)
    print(f"  added output {FEATURE_TENSOR} -> [batch, {NUM_CHANNELS}, 7, 7]")
    return model


def extract_cam_weights(fp32_model: onnx.ModelProto) -> np.ndarray:
    for init in fp32_model.graph.initializer:
        if init.name == CLASSIFIER_WEIGHT:
            w = numpy_helper.to_array(init)
            if w.shape != (NUM_CLASSES, NUM_CHANNELS):
                raise SystemExit(
                    f"{CLASSIFIER_WEIGHT} has shape {w.shape}, "
                    f"expected {(NUM_CLASSES, NUM_CHANNELS)}"
                )
            return w.astype(np.float32)
    raise SystemExit(f"{CLASSIFIER_WEIGHT!r} not found in the fp32 graph")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"source: {REPO}")

    int8_path = fetch("onnx/model_int8.onnx", CACHE / "model_int8.onnx")
    fp32_path = fetch("onnx/model.onnx", CACHE / "model.onnx")
    cfg_path = fetch("config.json", CACHE / "config.json")

    print("\npatching int8 graph for CAM ...")
    int8 = patch_feature_output(onnx.load(str(int8_path)))
    onnx.checker.check_model(int8)
    out_model = OUT_DIR / "model.onnx"
    onnx.save(int8, str(out_model))
    print(f"  wrote {out_model.relative_to(ROOT)} ({out_model.stat().st_size:,} bytes)")

    print("\nextracting classifier weights from the fp32 graph ...")
    weights = extract_cam_weights(onnx.load(str(fp32_path)))
    out_w = OUT_DIR / "cam_weights.bin"
    out_w.write_bytes(weights.tobytes(order="C"))
    print(
        f"  wrote {out_w.relative_to(ROOT)} "
        f"({weights.shape[0]}x{weights.shape[1]} float32, "
        f"{out_w.stat().st_size:,} bytes)"
    )

    print("\nwriting labels ...")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    id2label = cfg["id2label"]
    labels = [id2label[str(i)] for i in range(len(id2label))]
    if len(labels) != NUM_CLASSES:
        raise SystemExit(f"expected {NUM_CLASSES} labels, got {len(labels)}")
    out_labels = OUT_DIR / "labels.json"
    out_labels.write_text(json.dumps(labels, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {out_labels.relative_to(ROOT)} ({len(labels)} classes)")

    print("\ndone. Artifacts in public/models/leaf-v1/")


if __name__ == "__main__":
    main()
