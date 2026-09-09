# COMPUTER-VISION.md — Leaf disease scanner

> Feature spec: `planned_features.md` §3 (Disease & pest vision scanner).
> Onboarding context: `CONTEXT-FOR-CV-LAYER.md`.
> Written 2026-09-09. Branch `main`.

Progress tracker for the CV layer. Legend: ✅ shipped in-repo · 🔧 shipped but
needs a follow-up · ⏳ blocked on Supabase access · 📋 not started.

---

## 1. Status at a glance

| Item | Status |
|---|---|
| Phase 1 — on-device leaf scanner (classify + explainability + honest refusal) | ✅ code complete |
| Phase 1 — `farm_scans` persistence | ⏳ table migration written, not applied (no Supabase access) |
| Phase 2 — scan result fused into the AI assistant's context | ✅ code complete |
| Phase 2 — pesticide / chemical-dosage safety gate | 🔧 shipped as a prompt rule (see §9) |
| Phase 2 — cited disease-treatment corpus | 📋 needs Supabase write access to seed |
| Phase 3 — community disease feed (neighbour scans) | 📋 schema column reserved, nothing built |

`npx tsc --noEmit` clean · `npm run build` clean · `python -m py_compile` clean on the
backend. Not integration-tested against a live backend (no local venv) or a live
Supabase (access pending).

---

## 2. Phase 1 — what shipped

An in-browser leaf scanner living inside Saath at `/saath/scan` (tab: **Scan**).

**Flow.** Farmer opens the Scan tab → the model + WASM runtime preload → farmer
takes/uploads a single-leaf photo → the image is decoded, EXIF-stripped, resized
(shortest edge 256) and centre-cropped to 224×224 entirely in memory → on-device
inference → one of three honest outcomes:

| Outcome | When | Shown |
|---|---|---|
| `diagnosed` | top class ≥ 0.70 confidence | disease name + confidence + CAM overlay + provenance caption |
| `low_confidence` | top class < 0.70 | "not confident enough", top-3 possibilities, no single verdict |
| `not_covered` | the farm's crop has no class in the model | amber panel routing the farmer to a KVK extension officer — **the model never runs** |

**Nothing leaves the device on this path.** Inference is `onnxruntime-web` (WASM) on
the quantised model in `public/models/leaf-v1/`; the canvas re-encode strips any GPS
geotag; there is no network call past the model's own asset load. This is
`planned_features.md` §1's DPDP-Act-2023 flag on farm data, honoured by construction.

**Explainability.** An **exact** class activation map (Zhou et al. 2016), not
Grad-CAM: MobileNetV2 is `conv → GlobalAveragePool → Linear`, the architecture CAM
was defined for, so `CAM_c(y,x) = Σ_k W[c,k]·A[k,y,x]` is exact from a single forward
pass — no gradients, no approximation. The 7×7 map is upscaled and drawn as a red
heat overlay on the 224×224 crop. `scripts/prepare_leaf_model.py` patches the ONNX
graph to emit the pre-pool feature map as a second output and extracts the classifier
weight matrix (`cam_weights.bin`) so this needs no Python at inference time.

**Why on-device / quantised.** `planned_features.md` §3 ("export to ONNX/TFLite,
quantized, for on-device inference") and the Render free tier's 512 MB limit, which
already OOM-died once loading torch + an 80 MB model. Cost note: the ONNX Runtime
WASM binary Vite bundles is ~14 MB — far bigger than the 2.7 MB model — a real
first-visit cost on rural connections, cached indefinitely after.

---

## 3. Phase 2 — what shipped

**The scan result is fused into the global AI assistant**, so "what should I do about
this?" is answered against the scan **plus** the farm's soil pH / N / P, weather, and
crop stage — `planned_features.md` §3's differentiator over a standalone plant-ID.

- `ScanPage` publishes the live result to the assistant via `useAssistantPageContext`
  while the Scan tab is mounted, and clears it on unmount. **Session-scoped** — no
  writes to `knowledge_chunks`, no corpus pollution.
- `AssistantPageContext.scanContext` → `AskPayload.scan` → backend `AskRequest.scan`
  (`ScanContext` Pydantic model) → rendered into `formatted_input` next to the
  existing season block.
- The system prompt now tells the model to combine a `Leaf scan` line with the soil
  and weather numbers rather than answer it alone, and to treat a `low_confidence` or
  `not_covered` scan as **not a confirmed diagnosis**.
- Confidence is passed through **exactly as the model returned it** — the prompt says
  "use exactly this figure, never round it up". Same no-invented-certainty discipline
  as the data-provenance tags.

**Pesticide / chemical safety gate** (`planned_features.md` §5 — "incorrect
pesticide-dosage advice is a safety problem, not a UX one"). Implemented as a system-
prompt rule: non-chemical and preventive steps first; a named pesticide / active
ingredient only as an example; **no dose, concentration or mixing ratio** unless the
farmer supplied one; always defer the exact product and dose to the label and the
local KVK / agri-officer; never present a chemical + dose as a direct instruction.

---

## 4. The model

| | |
|---|---|
| Repo | `onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX` |
| Build used | `model_int8.onnx`, 2.7 MB, patched for the CAM feature output |
| Architecture | MobileNetV2 (1.0, 224) |
| Training data | PlantVillage — Kaggle "New Plant Diseases Dataset" version — 38 classes / 14 species, **lab-condition photographs** |
| Upstream eval | 95.4% accuracy on the PlantVillage test split |
| Base checkpoint | `linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification` |

**14 species in the raw model:** apple, blueberry, cherry, corn/maize, grape, orange,
peach, bell pepper, potato, raspberry, soybean, squash, strawberry, tomato.

**What the scanner actually diagnoses** (gated by `src/lib/leafScan/coverage.ts`
against TerraLearn's `CROP_DATABASE`):

| Coverage | Crops | Classes |
|---|---|---|
| Full | corn, grapes, potatoes, peppers, strawberries, tomatoes | tomato has 10, the rest 2–4 |
| Healthy-only | soybeans | PlantVillage has only "healthy soybean" — a "no disease" result here is **not** evidence of health, and the UI says so |
| None (honest refusal) | wheat, rice, barley, oats, cotton, sorghum, sugarcane, lettuce, carrots, onions, cabbage, spinach, cucumbers | — |

Softmax is computed **only over the crop's permitted class ids**, so a tomato scan is
never scored against grape classes and its confidence can't be inflated by classes
that were never in contention.

### Deviation from `planned_features.md` §3

The spec calls for a **hybrid CNN+ViT trained on a merged PlantVillage + PlantDoc +
crop-specific dataset**. Phase 1 ships a **pretrained MobileNetV2 on PlantVillage
alone** as a deliberate shortcut to get the whole pipeline (capture → inference →
CAM → coverage gate → fusion → UI) working end-to-end. Consequences, acknowledged:

- The lab-vs-field generalisation gap §3 warns about is **not** addressed — real phone
  photos will underperform the demo.
- `farm_scans.model_id` / `model_version` columns exist precisely so historical rows
  stay attributable when the trained model replaces this one.
- No Indian staples (rice, wheat, cotton, sugarcane) are covered — those need either
  per-crop expert models or a retrain (see §8).

---

## 5. Honesty gates

| Gate | Where | State |
|---|---|---|
| Coverage — never label a crop the model can't see | `src/lib/leafScan/coverage.ts` | ✅ enforced; unlisted crop fails safe to `none` |
| Confidence threshold — escalate below it instead of guessing | `src/lib/leafScan/threshold.ts` | 🔧 `LOW_CONFIDENCE_THRESHOLD = 0.70`, `IS_CALIBRATED = false` — chosen by feel, UI says so |
| Provenance caption on every result | `src/lib/dataProvenance.ts` → `leafScanProvenanceLabel` | ✅ "on-device model, lab-condition training, not a lab diagnosis" |
| Threshold calibration script | `scripts/calibrate_threshold.py` | 📋 not yet written — must evaluate on held-out **PlantDoc** field images, not PlantVillage |

---

## 6. Database — `farm_scans`

Migration: `supabase/migrations/20260909_03_farm_scans.sql`. **Written, not applied.**

- Farm-scoped, RLS via `is_farm_member(farm_id, 'worker')` — same pattern as
  `crop_cycles` / `farm_events`.
- `coverage` / `outcome` are `text` + `CHECK`; a `farm_scans_diagnosis_matches_outcome`
  constraint enforces that a `diagnosed` row has a diagnosis + confidence, a
  `low_confidence` row has confidence but no diagnosis, and a `not_covered` row has
  neither. The frontend's `createFarmScan` payloads satisfy all three.
- `location geography(Point,4326)` (not lat/lng floats) so a future "nearby reports"
  RPC can use `st_dwithin` — mirrors `listings.location`.
- `image_url` / `severity` / `shared_to_saath` exist but are unpopulated in Phase 1
  (on-device inference, no severity output, no community feed yet).
- Depends on `crop_cycles` (`20260909_01`) and `is_farm_member` (`20260908_02`), both
  already in `main` — so only `20260909_03` needs applying.

**Persistence is best-effort.** `ScanPage` builds the result from the on-device
inference and shows it regardless of whether the row saved. A failed insert (missing
table, RLS denial) logs a `console.warn` and shows a small "Not saved to your scan
history" note — it never swallows the diagnosis. So the scanner and the Phase 2
assistant fusion **work fully without the migration**; only the "Past scans" list
stays empty.

---

## 7. How to run / test it

```bash
git pull
npm install                 # picks up onnxruntime-web (the only new dep)
npm run dev
```

Backend (`git pull` brings the `scan` field + prompt changes — restart uvicorn):

```bash
cd backend && python run_backend.py     # needs OPENAI_API_KEY (Groq) in backend/.env.local
```

**To test the full diagnosis + fusion path:**

1. Apply `supabase/migrations/20260909_03_farm_scans.sql` in the Supabase dashboard
   (optional — the scanner works without it, but "Past scans" needs it).
2. Sign in and make sure the active farm's **primary crop is one of the six covered
   ones** (tomato / potato / corn / grape / pepper / strawberry). No seeded persona
   grows a covered crop — Ramesha=paddy, Chikkamma=sericulture, Manjula=mushroom all
   hit the "not covered" path. Change it via FarmSwitcher → "update this farm".
3. Get test images: Kaggle "New Plant Diseases Dataset" (`vipoooool`) — the exact
   training set — `valid/` split, e.g. a tomato or potato leaf. None are bundled in
   the repo.
4. Scan → confirm the disease name, confidence and CAM overlay render.
5. Open the floating assistant **while still on the Scan tab**, ask "what should I do
   about this?" → confirm the answer references the scan **and** the soil/weather
   numbers, hedges a `low_confidence` result, and doesn't hand out a pesticide dose.

**Not-covered path** (any persona as-is): scan → confirm the amber KVK panel, and that
the assistant says it needs an expert rather than guessing a disease.

---

## 8. Not done yet / next

| # | Item | Blocker / note |
|---|---|---|
| 1 | Apply `20260909_03` | Supabase access |
| 2 | Cited disease-treatment corpus (`backend/data/knowledge/` files per covered crop, sourced to ICAR / state ag universities) | needs a temp Supabase write policy to seed; today the assistant *generates* treatment advice rather than citing it — `planned_features.md` §5's grounding requirement |
| 3 | Calibrate `LOW_CONFIDENCE_THRESHOLD` | write `scripts/calibrate_threshold.py`, run against held-out PlantDoc |
| 4 | Real draft-and-confirm flow for chemical advice | the pasted plan wanted the `terralearn-action` block; that parser only knows `send_message` and there's no frontend confirm-card for a non-message action — Phase 2 ships the prompt-rule version instead |
| 5 | Confirmed detection → adjust the yield simulator's projection | `planned_features.md` §3 ("should also adjust the yield simulator's prediction, not sit in an isolated tab") |
| 6 | Scanner as the marketplace **quality-grading** step at lot-creation | `planned_features.md` §3 / PS-26132 requirement |
| 7 | Trained hybrid CNN+ViT on merged datasets | replaces the pretrained MobileNetV2; `model_id`/`model_version` columns already support the swap |
| 8 | Indian-staple coverage (rice first) | either per-crop expert models (server-side, breaks the CAM trick) or a retrain — investigated, deferred |
| 9 | Phase 3 — community disease feed | `farm_scans.shared_to_saath` column reserved; additive migration when built |
| 10 | Wire `season` context into the assistant payload | pre-existing gap, not CV-specific: `AskPayload.season` + backend `SeasonContext` exist but `AssistantProvider.send()` never populates it and `home.tsx` never passes it to the hook — same one-liner as `scan` |

---

## 9. Deviations from the original plan — summary

| Plan (`planned_features.md` §3 / §5, and the Phase 2 build plan) | What shipped | Why |
|---|---|---|
| Hybrid CNN+ViT, merged PlantVillage+PlantDoc | Pretrained MobileNetV2, PlantVillage only | Phase-1 shortcut to get the pipeline working; swap-ready |
| Grad-CAM | Exact CAM (Zhou 2016) | MobileNetV2's `conv→GAP→Linear` makes CAM exact and gradient-free — strictly better here |
| Chemical advice via the `terralearn-action` draft-and-confirm block | System-prompt rule (no dose without the farmer's numbers, defer to label + KVK) | The action block only supports `send_message`; a new confirm-card is its own task |
| Treatment advice cited from a disease corpus | Model-generated for now | Seeding the corpus needs Supabase write access |

---

## 10. File map

```
Frontend
  src/components/saath/ScanPage.tsx        # the Scan tab — capture, result, history, assistant publish
  src/lib/leafScan/
    model.ts                               # onnxruntime-web inference + exact CAM
    image.ts                               # decode, EXIF strip, resize/crop, tensor
    coverage.ts                            # crop → permitted classes / honest refusal
    threshold.ts                           # confidence gate (uncalibrated)
  src/lib/saath/scans.ts                   # createFarmScan / listFarmScans (best-effort)
  src/lib/saath/types.ts                   # FarmScan, LeafScan* DTOs
  src/lib/dataProvenance.ts                # leafScanProvenanceLabel
  src/lib/assistant/
    types.ts                               # ScanContextData, AssistantPageContext.scanContext, AskPayload.scan
    useAssistantPageContext.ts             # threads scanContext through
    AssistantProvider.tsx                  # payload build: scan: pc?.scanContext ?? null
  src/components/saath/SaathApp.tsx        # /saath/scan route
  src/components/saath/SaathLayout.tsx     # Scan tab

Backend
  backend/app/main.py                      # ScanContext model, AskRequest.scan, formatted_input rendering
  backend/app/agent.py                     # system prompt: leaf-scan fusion + pesticide safety rules

Assets & tooling
  public/models/leaf-v1/                   # model.onnx (2.7 MB), cam_weights.bin, labels.json — committed
  scripts/prepare_leaf_model.py            # rebuilds the above from the HF checkpoint
  .cache/                                  # raw upstream ONNX downloads — gitignored

Database
  supabase/migrations/20260909_03_farm_scans.sql   # NOT YET APPLIED
```
