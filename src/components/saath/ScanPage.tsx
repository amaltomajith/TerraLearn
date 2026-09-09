// Leaf disease scanner (planned_features.md sec.3), phase 1: upload a leaf
// photo, get an on-device classification with an explainability overlay, or
// an honest refusal for crops the model can't cover. Lives inside Saath per
// the product brief — layout chrome (Navigation, tab bar) comes from
// SaathLayout, this component renders content only.
//
// Persistence (farm_scans, migrations/20260909_03) is best-effort: the result
// is built from the on-device inference and shown regardless of whether the
// row saved, so a missing migration or an RLS denial degrades to "not saved
// to history" rather than swallowing the diagnosis. Phase 2 also publishes the
// live result to the global assistant via useAssistantPageContext, so "what
// should I do about this?" reaches the assistant with the scan + soil +
// weather fused (sec.3's differentiator).

import { useRef, useState, useEffect, useMemo, useCallback, type RefObject } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Camera, Loader2, ShieldQuestion } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { useFarmSeason } from '@/lib/farm/useFarmSeason';
import { useAssistantPageContext } from '@/lib/assistant/useAssistantPageContext';
import type { ScanContextData } from '@/lib/assistant/types';
import { listFarmScans, createFarmScan } from '@/lib/saath/scans';
import type { FarmScan, LeafScanCoverage, LeafScanOutcome, LeafScanClassScore } from '@/lib/saath/types';
import { SectionCard, EmptyState } from './primitives';
import { coverageFor } from '@/lib/leafScan/coverage';
import { preprocessLeafImage } from '@/lib/leafScan/image';
import { runLeafScan, preloadLeafModel } from '@/lib/leafScan/model';
import { outcomeForConfidence, IS_CALIBRATED, LOW_CONFIDENCE_THRESHOLD } from '@/lib/leafScan/threshold';
import { leafScanProvenanceLabel, checkedOn } from '@/lib/dataProvenance';

const MODEL_ID = 'onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX';
const MODEL_VERSION = 'int8';

type Stage = 'idle' | 'preprocessing' | 'inferring' | 'saving';

interface LiveResult {
  crop: string;
  coverage: LeafScanCoverage;
  outcome: LeafScanOutcome;
  diagnosis: string | null;
  confidence: number | null;
  top3: LeafScanClassScore[] | null;
  scannedAt: string; // ISO
  /** false when the farm_scans insert failed — the result is still shown. */
  saved: boolean;
  camGrid: Float32Array; // 7x7, [0,1]
  cropDisplayCanvas: HTMLCanvasElement;
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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warm the model + WASM runtime as soon as the page is open, not on first
  // tap — the WASM binary is ~14 MB (see src/lib/leafScan/model.ts), so
  // starting that fetch early hides some of the latency behind the farmer
  // reading the page.
  useEffect(() => {
    preloadLeafModel();
  }, []);

  const cropKey = (primaryFarm?.primary_crop ?? '').toLowerCase();
  const coverage = coverageFor(cropKey);

  // Publish the current scan result to the global assistant while this page is
  // mounted; cleared on unmount by useAssistantPageContext. This is the
  // session-scoped fusion input from sec.3 — no corpus writes.
  const scanContext = useMemo<ScanContextData | null>(() => {
    if (!live) return null;
    return {
      crop: live.crop,
      outcome: live.outcome,
      diagnosis: live.diagnosis,
      confidence: live.confidence,
      scannedAt: live.scannedAt,
    };
  }, [live]);

  useAssistantPageContext({
    position: primaryFarm ? { lat: primaryFarm.lat, lng: primaryFarm.lng } : null,
    scanContext,
  });

  const drawOverlay = useCallback((cropCanvas: HTMLCanvasElement, camGrid: Float32Array) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    overlay.width = cropCanvas.width;
    overlay.height = cropCanvas.height;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(cropCanvas, 0, 0);

    // Upscale the 7x7 CAM to the 224x224 crop with a tiny intermediate
    // canvas so the browser's own bilinear scaling does the interpolation.
    const small = document.createElement('canvas');
    small.width = 7;
    small.height = 7;
    const sctx = small.getContext('2d');
    if (!sctx) return;
    const imgData = sctx.createImageData(7, 7);
    for (let i = 0; i < 49; i++) {
      const v = camGrid[i];
      // Red channel carries intensity; alpha ramps with it so cold regions
      // stay see-through rather than tinting the whole photo.
      imgData.data[i * 4 + 0] = 255;
      imgData.data[i * 4 + 1] = Math.round(60 * (1 - v));
      imgData.data[i * 4 + 2] = 0;
      imgData.data[i * 4 + 3] = Math.round(180 * v);
    }
    sctx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, 7, 7, 0, 0, overlay.width, overlay.height);
  }, []);

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

      if (coverage.kind === 'none') {
        // Never run the model at all — no label, no percentage, ever, for a
        // crop the model has no class for. See coverage.ts.
        setStage('saving');
        const saved = await persist({
          farmId,
          cycleId: activeCycle?.id ?? null,
          crop: cropKey || 'unknown',
          coverage: 'none',
          outcome: 'not_covered',
          modelId: MODEL_ID,
          modelVersion: MODEL_VERSION,
          scannedBy: activeFarmerId,
        });
        setLive({
          crop: cropKey || 'unknown',
          coverage: 'none',
          outcome: 'not_covered',
          diagnosis: null,
          confidence: null,
          top3: null,
          scannedAt,
          saved,
          camGrid: new Float32Array(49),
          cropDisplayCanvas: document.createElement('canvas'),
        });
        return;
      }

      setStage('preprocessing');
      const { tensor, displayCanvas } = await preprocessLeafImage(file);

      setStage('inferring');
      const { top3, cam } = await runLeafScan(tensor, coverage);
      const top = top3[0];
      const outcome = outcomeForConfidence(top.confidence);
      const coverageTag: LeafScanCoverage = coverage.kind === 'healthy-only' ? 'healthy_only' : 'full';
      const diagnosis = outcome === 'diagnosed' ? top.label : null;

      setStage('saving');
      const saved = await persist({
        farmId,
        cycleId: activeCycle?.id ?? null,
        crop: cropKey,
        coverage: coverageTag,
        outcome,
        diagnosis,
        confidence: top.confidence,
        top3,
        modelId: MODEL_ID,
        modelVersion: MODEL_VERSION,
        scannedBy: activeFarmerId,
      });

      setLive({
        crop: cropKey,
        coverage: coverageTag,
        outcome,
        diagnosis,
        confidence: top.confidence,
        top3,
        scannedAt,
        saved,
        camGrid: cam,
        cropDisplayCanvas: displayCanvas,
      });
      drawOverlay(displayCanvas, cam);
    } catch (e) {
      toast.error((e as Error).message);
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
          {coverage.kind === 'none' ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <ShieldQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  This scanner doesn't cover {primaryFarm.primary_crop ?? 'this crop'} yet.
                </p>
                <p className="text-muted-foreground mt-1">
                  The model was trained on a different set of crops. Rather than guess, we'll
                  route this to an expert — talk to your nearest KVK (Krishi Vigyan Kendra)
                  extension officer for {primaryFarm.primary_crop ?? 'this crop'}.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Photograph a single leaf against a plain background, in daylight, filling the
              frame. Works on {primaryFarm.primary_crop}.
            </p>
          )}

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

          {live && <ResultCard live={live} overlayCanvasRef={overlayCanvasRef} />}

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

function ResultCard({
  live,
  overlayCanvasRef,
}: {
  live: LiveResult;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  if (live.outcome === 'not_covered') {
    return null; // the amber "not covered" panel above already said everything
  }

  const coverage = live.coverage === 'healthy_only' ? 'healthy_only' : 'full';
  const provenance = leafScanProvenanceLabel(
    coverage,
    live.outcome === 'diagnosed' ? 'diagnosed' : 'low_confidence',
  );

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <canvas ref={overlayCanvasRef} className="w-full max-w-xs rounded-lg border border-border/40" />

      {live.outcome === 'low_confidence' ? (
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Not confident enough for a diagnosis</p>
            <p className="text-muted-foreground mt-1">
              Top possibilities: {(live.top3 ?? []).map((t) => `${t.label} (${Math.round(t.confidence * 100)}%)`).join(', ')}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p className="font-semibold text-foreground">
            {live.diagnosis} — {Math.round((live.confidence ?? 0) * 100)}% confidence
          </p>
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
