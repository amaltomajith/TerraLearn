// Confidence-gated escalation (planned_features.md sec.3's non-negotiable:
// "confidence-gated escalation to a human ... rather than presenting an
// uncertain guess as fact"). The discipline that matters here is not the
// number itself, it's how it was chosen — see the upstream PlantVillage ViT
// model card for the right model of this: "Routing threshold 0.95 was
// measured on held-out maize predictions, not guessed."
//
// scripts/calibrate_threshold.py (not yet run) is meant to reproduce that:
// evaluate the model on held-out PlantDoc field images — not PlantVillage,
// whose lab-condition bias is exactly what sec.3 warns about — for the
// covered crops, and report the error-vs-referral tradeoff at each
// threshold. Until that script has run and this constant been replaced with
// its output, IS_CALIBRATED stays false and the UI must say so; a plausible-
// looking number that was picked by feel is worse than an honest "we
// haven't measured this yet."

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Flip to true only when LOW_CONFIDENCE_THRESHOLD was set from
 *  scripts/calibrate_threshold.py output, not chosen by feel. */
export const IS_CALIBRATED = false;

export type LeafScanOutcome = 'diagnosed' | 'low_confidence' | 'not_covered';

export function outcomeForConfidence(confidence: number): 'diagnosed' | 'low_confidence' {
  return confidence >= LOW_CONFIDENCE_THRESHOLD ? 'diagnosed' : 'low_confidence';
}
