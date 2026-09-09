// Leaf scanner (planned_features.md sec.3), phase 1: upload a leaf photo, get
// an on-device identification (which of 14 plants + its disease/pest) with an
// explainability overlay, or an honest low-confidence refusal. Lives inside
// Saath per the product brief — layout chrome (Navigation, tab bar) comes from
// SaathLayout, this component renders content only.
//
// The scanner is NOT gated to the farm's registered crop any more — the model
// identifies the plant from the photo itself (src/lib/leafScan/classes.ts).
// The trade-off, surfaced to the farmer: it always names one of its 14 plants
// even when the photo is of none of them, so the result leads with the
// detected plant for a sanity check and the caption states the 14-plant limit.
//
// Persistence (farm_scans, migrations/20260909_03) is best-effort: the result
// is built from the on-device inference and shown regardless of whether the
// row saved, so a missing migration or an RLS denial degrades to "not saved
// to history" rather than swallowing the result. Phase 2 also publishes the
// live result to the global assistant via useAssistantPageContext, so "what
// should I do about this?" reaches the assistant with the scan + soil +
// weather fused (sec.3's differentiator).

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { useFarmSeason } from '@/lib/farm/useFarmSeason';
import { useAssistantPageContext } from '@/lib/assistant/useAssistantPageContext';
import type { ScanContextData } from '@/lib/assistant/types';
import { listFarmScans, createFarmScan } from '@/lib/saath/scans';
import type { FarmScan, LeafScanCoverage, LeafScanClassScore } from '@/lib/saath/types';
import { SectionCard, EmptyState } from './primitives';
import {
  KNOWN_SPECIES,
  SINGLE_CLASS_SPECIES,
  leafClass,
  describeLeafClass,
} from '@/lib/leafScan/classes';
import { preprocessLeafImage } from '@/lib/leafScan/image';
import { runLeafScan, preloadLeafModel } from '@/lib/leafScan/model';
import { outcomeForConfidence, IS_CALIBRATED, LOW_CONFIDENCE_THRESHOLD } from '@/lib/leafScan/threshold';
import { leafScanProvenanceLabel, checkedOn } from '@/lib/dataProvenance';

const MODEL_ID = 'onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX';
const MODEL_VERSION = 'fp32';

type Stage = 'idle' | 'preprocessing' | 'inferring' | 'saving';

interface LiveResult {
  species: string;
  condition: string | null;
  healthy: boolean;
  /** the model has only one class for this plant — can't judge its health */
  singleClass: boolean;
  outcome: 'diagnosed' | 'low_confidence';
  confidence: number; // 0-1, exactly as the model returned it
  top3: LeafScanClassScore[];
  scannedAt: string; // ISO
  /** false when the farm_scans insert failed — the result is still shown. */
  saved: boolean;
  camGrid: Float32Array; // 7x7, [0,1]
  cropDisplayCanvas: HTMLCanvasElement; // the 224x224 crop the model actually saw
}

export function ScanPage() {
  const { activeFarmerId, primaryFarm } = useSaathIdentity();
  const farmId = primaryFarm?.id ?? null;
  const { activeCycle } = useFarmSeason(farmId);

  const { data: history, loading: historyLoading, reload } = useAsync(
    () => (farmId ? listFarmScans(farmId) : Promise.resolve([])),
    [farmId],
  );

  const [stage, setStage] = useState<Stage>('idle');
  const [live, setLive] = useState<LiveResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warm the model + WASM runtime as soon as the page is open, not on first
  // tap — the WASM binary is ~14 MB (see src/lib/leafScan/model.ts), so
  // starting that fetch early hides some of the latency behind the farmer
  // reading the page.
  useEffect(() => {
    preloadLeafModel();
  }, []);

  // Publish the current scan result to the global assistant while this page is
  // mounted; cleared on unmount by useAssistantPageContext. This is the
  // session-scoped fusion input from sec.3 — no corpus writes.
  const scanContext = useMemo<ScanContextData | null>(() => {
    if (!live) return null;
    return {
      crop: live.species,
      outcome: live.outcome,
      diagnosis:
        live.outcome === 'diagnosed'
          ? (live.healthy ? `${live.species}: no disease signs` : `${live.species}: ${live.condition}`)
          : null,
      confidence: live.confidence,
      scannedAt: live.scannedAt,
    };
  }, [live]);

  useAssistantPageContext({
    position: primaryFarm ? { lat: primaryFarm.lat, lng: primaryFarm.lng } : null,
    scanContext,
  });

  // Best-effort persistence: the caller already has (and shows) the result, so
  // a failed insert is logged and reported as "not saved", never thrown.
  const persist = useCallback(
    async (input: Parameters<typeof createFarmScan>[0]): Promise<boolean> => {
      try {
        await createFarmScan(input);
        reload();
        return true;
      } catch (e) {
        console.warn('farm_scans save failed (result still shown):', e);
        return false;
      }
    },
    [reload],
  );

  async function handleFile(file: File) {
    if (!farmId || !activeFarmerId) {
      toast.error('Set up a farm before scanning.');
      return;
    }
    setLive(null);

    try {
      const scannedAt = new Date().toISOString();

      setStage('preprocessing');
      const { tensor, displayCanvas } = await preprocessLeafImage(file);

      setStage('inferring');
      const { top3, cam } = await runLeafScan(tensor);
      const top = top3[0];
      const cls = leafClass(top.classId);
      const outcome = outcomeForConfidence(top.confidence); // 'diagnosed' | 'low_confidence'
      const singleClass = SINGLE_CLASS_SPECIES.has(cls.species);
      const diagnosis = outcome === 'diagnosed' ? describeLeafClass(cls) : null;

      setStage('saving');
      const saved = await persist({
        farmId,
        cycleId: activeCycle?.id ?? null,
        crop: cls.species.toLowerCase(),
        coverage: (singleClass ? 'healthy_only' : 'full') as LeafScanCoverage,
        outcome,
        diagnosis,
        confidence: top.confidence,
        top3,
        modelId: MODEL_ID,
        modelVersion: MODEL_VERSION,
        scannedBy: activeFarmerId,
      });

      setLive({
        species: cls.species,
        condition: cls.condition,
        healthy: cls.healthy,
        singleClass,
        outcome,
        confidence: top.confidence,
        top3,
        scannedAt,
        saved,
        camGrid: cam,
        cropDisplayCanvas: displayCanvas,
      });
    } catch (e) {
      console.error('leaf scan failed:', e);
      toast.error((e as Error).message || 'Scan failed — see the console for details.');
    } finally {
      setStage('idle');
    }
  }

  const busy = stage !== 'idle';

  return (
    <SectionCard title="Scan a leaf">
      {!primaryFarm ? (
        <EmptyState>Set up a farm to use the scanner.</EmptyState>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Photograph a single leaf against a plain background, in daylight, filling the
            frame. The scanner recognises {KNOWN_SPECIES.length} plants —{' '}
            {KNOWN_SPECIES.join(', ')} — and will still name one of them even if your plant
            isn't on the list, so check the plant name in the result matches what you
            photographed.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // allow re-selecting the same file
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 h-10 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {stageLabel(stage)}
          </button>

          {!IS_CALIBRATED && (
            <p className="text-xs text-muted-foreground">
              Confidence threshold ({Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}%) is provisional
              — not yet calibrated against field photographs.
            </p>
          )}

          {live && <ResultCard live={live} />}

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Past scans</h3>
            {historyLoading && <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />}
            {history && history.length === 0 && <EmptyState>No scans yet.</EmptyState>}
            <div className="space-y-2">
              {(history ?? []).map((s) => (
                <HistoryRow key={s.id} scan={s} />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'preprocessing':
      return 'Preparing image…';
    case 'inferring':
      return 'Analysing…';
    case 'saving':
      return 'Saving…';
    default:
      return 'Take or upload a photo';
  }
}

/**
 * Paint the 224x224 crop the model saw, then the CAM heat over it: the 7x7 map
 * upscaled by the browser's own bilinear scaling, red channel carrying
 * intensity, alpha ramping with it so cold regions stay see-through.
 */
function drawOverlay(
  overlay: HTMLCanvasElement,
  cropCanvas: HTMLCanvasElement,
  camGrid: Float32Array,
): void {
  overlay.width = cropCanvas.width;
  overlay.height = cropCanvas.height;
  const ctx = overlay.getContext('2d');
  if (!ctx) return;

  ctx.drawImage(cropCanvas, 0, 0);

  const small = document.createElement('canvas');
  small.width = 7;
  small.height = 7;
  const sctx = small.getContext('2d');
  if (!sctx) return;
  const imgData = sctx.createImageData(7, 7);
  for (let i = 0; i < 49; i++) {
    const v = camGrid[i];
    imgData.data[i * 4 + 0] = 255;
    imgData.data[i * 4 + 1] = Math.round(60 * (1 - v));
    imgData.data[i * 4 + 2] = 0;
    imgData.data[i * 4 + 3] = Math.round(180 * v);
  }
  sctx.putImageData(imgData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, 7, 7, 0, 0, overlay.width, overlay.height);
}

function ResultCard({ live }: { live: LiveResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const provenance = leafScanProvenanceLabel(live.singleClass, live.outcome);

  // Draw from an effect, not the scan handler: the canvas only exists once this
  // component has mounted, so a synchronous draw right after setLive() finds a
  // null ref and silently no-ops (that was the "empty box" bug). Re-runs per
  // scan because `live` is a fresh object each time.
  useEffect(() => {
    if (canvasRef.current) drawOverlay(canvasRef.current, live.cropDisplayCanvas, live.camGrid);
  }, [live]);

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <figure className="space-y-1">
        <canvas
          ref={canvasRef}
          className="w-full max-w-xs rounded-lg border border-border/40"
        />
        <figcaption className="text-xs text-muted-foreground">
          What the model looked at — brighter red = drove the identification more
        </figcaption>
      </figure>

      {live.outcome === 'low_confidence' ? (
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Not sure enough to call it</p>
            <p className="text-muted-foreground mt-1">
              Closest matches:{' '}
              {live.top3
                .map((t) => `${t.label} (${Math.round(t.confidence * 100)}%)`)
                .join(', ')}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{live.species}</p>
          <p className="font-semibold text-foreground">
            {live.healthy ? 'No disease signs detected' : live.condition} —{' '}
            {Math.round(live.confidence * 100)}% confidence
          </p>
          {live.singleClass && (
            <p className="text-xs text-amber-600 mt-1">
              The model has only one {live.species} class — it can tell the plant looks like{' '}
              {live.species}, not whether it is diseased.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{provenance}</p>
      {!live.saved && (
        <p className="text-xs text-amber-600">
          Not saved to your scan history — this result is shown for now only.
        </p>
      )}
    </div>
  );
}

function HistoryRow({ scan }: { scan: FarmScan }) {
  const label =
    scan.outcome === 'not_covered'
      ? `${scan.crop} — not covered`
      : scan.outcome === 'diagnosed'
        ? `${scan.diagnosis} (${Math.round((scan.confidence ?? 0) * 100)}%)`
        : `${scan.crop} — low confidence`;

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
      <p className="text-sm text-foreground truncate">{label}</p>
      <p className="text-xs text-muted-foreground shrink-0">{checkedOn(scan.created_at)}</p>
    </div>
  );
}
