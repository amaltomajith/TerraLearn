// The 38 PlantVillage classes the leaf model (public/models/leaf-v1/) can
// output, as structured data. labels.json holds the raw strings; this file is
// the parsed form the UI needs — which plant, what condition, whether the
// class means "healthy".
//
// Phase 1 no longer gates the scanner to the farm's registered crop. The model
// identifies the plant from the photo itself, across these 14 species, and the
// only refusal is a low-confidence one (src/lib/leafScan/threshold.ts).
//
// The limitation this carries, stated plainly to the farmer in the UI: a
// 38-way softmax always names one of these classes even for a plant that is
// none of them — an onion or a wheat leaf comes back as some tomato/corn
// class with a confident-looking number. So the result always leads with the
// detected plant name for the farmer to sanity-check against what they
// actually photographed, and the provenance caption spells out the 14-plant
// limit. A real fix (a "not one of these" class, or a species-ID model in
// front) is future work — see COMPUTER-VISION.md.

export interface LeafClass {
  id: number;
  /** Plant display name, e.g. "Tomato", "Corn", "Bell Pepper". */
  species: string;
  /** Disease / pest / disorder, or null for a "healthy" class. */
  condition: string | null;
  healthy: boolean;
}

// Index === position === labels.json index === upstream id2label id.
export const LEAF_CLASSES: LeafClass[] = [
  { id: 0, species: 'Apple', condition: 'Scab', healthy: false },
  { id: 1, species: 'Apple', condition: 'Black Rot', healthy: false },
  { id: 2, species: 'Apple', condition: 'Cedar Apple Rust', healthy: false },
  { id: 3, species: 'Apple', condition: null, healthy: true },
  { id: 4, species: 'Blueberry', condition: null, healthy: true },
  { id: 5, species: 'Cherry', condition: 'Powdery Mildew', healthy: false },
  { id: 6, species: 'Cherry', condition: null, healthy: true },
  { id: 7, species: 'Corn', condition: 'Cercospora / Gray Leaf Spot', healthy: false },
  { id: 8, species: 'Corn', condition: 'Common Rust', healthy: false },
  { id: 9, species: 'Corn', condition: 'Northern Leaf Blight', healthy: false },
  { id: 10, species: 'Corn', condition: null, healthy: true },
  { id: 11, species: 'Grape', condition: 'Black Rot', healthy: false },
  { id: 12, species: 'Grape', condition: 'Esca (Black Measles)', healthy: false },
  { id: 13, species: 'Grape', condition: 'Isariopsis Leaf Spot', healthy: false },
  { id: 14, species: 'Grape', condition: null, healthy: true },
  { id: 15, species: 'Orange', condition: 'Citrus Greening (HLB)', healthy: false },
  { id: 16, species: 'Peach', condition: 'Bacterial Spot', healthy: false },
  { id: 17, species: 'Peach', condition: null, healthy: true },
  { id: 18, species: 'Bell Pepper', condition: 'Bacterial Spot', healthy: false },
  { id: 19, species: 'Bell Pepper', condition: null, healthy: true },
  { id: 20, species: 'Potato', condition: 'Early Blight', healthy: false },
  { id: 21, species: 'Potato', condition: 'Late Blight', healthy: false },
  { id: 22, species: 'Potato', condition: null, healthy: true },
  { id: 23, species: 'Raspberry', condition: null, healthy: true },
  { id: 24, species: 'Soybean', condition: null, healthy: true },
  { id: 25, species: 'Squash', condition: 'Powdery Mildew', healthy: false },
  { id: 26, species: 'Strawberry', condition: 'Leaf Scorch', healthy: false },
  { id: 27, species: 'Strawberry', condition: null, healthy: true },
  { id: 28, species: 'Tomato', condition: 'Bacterial Spot', healthy: false },
  { id: 29, species: 'Tomato', condition: 'Early Blight', healthy: false },
  { id: 30, species: 'Tomato', condition: 'Late Blight', healthy: false },
  { id: 31, species: 'Tomato', condition: 'Leaf Mold', healthy: false },
  { id: 32, species: 'Tomato', condition: 'Septoria Leaf Spot', healthy: false },
  { id: 33, species: 'Tomato', condition: 'Spider Mites', healthy: false },
  { id: 34, species: 'Tomato', condition: 'Target Spot', healthy: false },
  { id: 35, species: 'Tomato', condition: 'Yellow Leaf Curl Virus', healthy: false },
  { id: 36, species: 'Tomato', condition: 'Mosaic Virus', healthy: false },
  { id: 37, species: 'Tomato', condition: null, healthy: true },
];

/** The 14 distinct plants the model can recognise (insertion order). */
export const KNOWN_SPECIES: string[] = [...new Set(LEAF_CLASSES.map((c) => c.species))];

/**
 * Species with only ONE class in the model. For these it can indicate the
 * plant looks like species X but cannot tell healthy from diseased —
 * Blueberry / Raspberry / Soybean have only a "healthy" class, Orange /
 * Squash have only a disease class.
 */
export const SINGLE_CLASS_SPECIES = new Set(
  KNOWN_SPECIES.filter(
    (s) => LEAF_CLASSES.filter((c) => c.species === s).length === 1,
  ),
);

export function leafClass(id: number): LeafClass {
  const c = LEAF_CLASSES[id];
  if (!c || c.id !== id) throw new Error(`Unknown leaf class id: ${id}`);
  return c;
}

/** "Tomato — Early Blight" / "Tomato — no disease signs". */
export function describeLeafClass(c: LeafClass): string {
  return c.healthy ? `${c.species} — no disease signs` : `${c.species} — ${c.condition}`;
}
