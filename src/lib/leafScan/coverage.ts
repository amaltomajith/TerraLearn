// What the leaf scanner can honestly say about a given crop.
//
// The model (public/models/leaf-v1/) is fine-tuned on PlantVillage — 38
// classes across 14 species, lab-condition photographs. TerraLearn's
// CROP_DATABASE (src/lib/api.ts) has 20 crops. The two lists barely overlap,
// and running the model on an unlisted crop does not fail loudly: softmax
// always produces a confident-looking number for *some* class, even when the
// right answer isn't in the class set at all. The upstream model card for a
// PlantVillage-trained ViT documents the same failure mode explicitly: "No
// unknown class... will return a confident label from a class set that
// cannot contain the right answer."
//
// This table is the gate that stops that from reaching a farmer. It is
// feature_status.md's "no silent fallback" provenance policy applied to a
// model output, per planned_features.md sec.3.
//
// Class ids below are indices into public/models/leaf-v1/labels.json
// (== the upstream id2label from config.json). Recomputed by hand from that
// file — see the comment on each entry.

export type CropCoverage =
  | { kind: 'full'; classIds: number[] }
  | { kind: 'healthy-only'; classIds: number[] }
  | { kind: 'none' };

/**
 * Keyed by CROP_DATABASE key (src/lib/api.ts), not display name.
 * Absence from this map is treated the same as `{ kind: 'none' }` — see
 * `coverageFor` below — so a future CROP_DATABASE addition fails safe.
 */
export const LEAF_SCAN_COVERAGE: Record<string, CropCoverage> = {
  // 7 Corn Cercospora/Gray Leaf Spot, 8 Common Rust, 9 N. Leaf Blight, 10 Healthy
  corn: { kind: 'full', classIds: [7, 8, 9, 10] },
  // 11 Black Rot, 12 Esca, 13 Isariopsis Leaf Spot, 14 Healthy
  grapes: { kind: 'full', classIds: [11, 12, 13, 14] },
  // 20 Early Blight, 21 Late Blight, 22 Healthy
  potatoes: { kind: 'full', classIds: [20, 21, 22] },
  // 18 Bacterial Spot, 19 Healthy (Bell Pepper)
  peppers: { kind: 'full', classIds: [18, 19] },
  // 26 Leaf Scorch, 27 Healthy
  strawberries: { kind: 'full', classIds: [26, 27] },
  // 28 Bacterial Spot .. 37 Healthy — the 10-class tomato block
  tomatoes: {
    kind: 'full',
    classIds: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
  },

  // 24 Healthy Soybean Plant is the ONLY soybean class in PlantVillage. The
  // model can never output a soybean disease — so a "no disease detected"
  // result here is not evidence of health, only evidence the model wasn't
  // trained to see one. Render that distinction; see leafScanProvenanceLabel.
  soybeans: { kind: 'healthy-only', classIds: [24] },

  // Everything else CROP_DATABASE knows about has zero PlantVillage classes:
  // wheat, rice, barley, oats, cotton, sorghum, sugarcane, lettuce, carrots,
  // onions, cabbage, spinach, cucumbers. Listed explicitly (rather than left
  // to the `undefined` fallback) so the gap is visible in a diff when
  // CROP_DATABASE grows and this table doesn't.
  wheat: { kind: 'none' },
  rice: { kind: 'none' },
  barley: { kind: 'none' },
  oats: { kind: 'none' },
  cotton: { kind: 'none' },
  sorghum: { kind: 'none' },
  sugarcane: { kind: 'none' },
  lettuce: { kind: 'none' },
  carrots: { kind: 'none' },
  onions: { kind: 'none' },
  cabbage: { kind: 'none' },
  spinach: { kind: 'none' },
  cucumbers: { kind: 'none' },
};

/** Fail-safe accessor: an unlisted crop is `none`, never treated as covered. */
export function coverageFor(cropKey: string): CropCoverage {
  return LEAF_SCAN_COVERAGE[cropKey] ?? { kind: 'none' };
}

export function isDiagnosable(cropKey: string): boolean {
  return coverageFor(cropKey).kind !== 'none';
}
