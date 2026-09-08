import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { Cloud, Leaf, Loader2, Sparkles, TestTube2, X, Zap, type LucideIcon } from 'lucide-react';
import { Navigation } from './Navigation';
import NavAuthControl from './saath/NavAuthControl';
import { MapView } from './MapView';
import { MetricCard } from './MetricCard';
import { CropSuggestions } from './CropSuggestions';
import { CropSelector } from './CropSelector';
import { DateSelector } from './DateSelector';
import { ENTERPRISES, enterpriseLabel } from '@/lib/saath/ifsMatrix';
import {
  createProfileWithFarm,
  addFarm,
  updateFarmDetails,
  getMapPoints,
} from '@/lib/saath/queries';
import { redeemInvite } from '@/lib/farm/queries';

import { haversineMeters } from '@/lib/saath/distance';
import { suggestCropsWithCircular, CROP_TO_ENTERPRISE } from '@/lib/cropEnterprise';
import { useIdentity } from '@/lib/identity/identity';
import { cn } from '@/lib/utils';
import {
  fetchLocationInfo,
  fetchSoilData,
  fetchClimateData,
  calculateYield,
  getSeason,
  getSeasonName,
  type LocationInfo,
  type SoilData,
  type ClimateData,
} from '@/lib/api';
import { INDICATIVE_PRICE_NOTE } from '@/lib/enterpriseReference';
import {
  soilProvenanceLabel,
  climateProvenanceLabel,
  SOIL_PK_DISCLAIMER,
} from '@/lib/dataProvenance';
import { previewMetrics, pinSummary, type PreviewProvenance } from '@/lib/onboardingPreview';
import type { FarmerRole, MapPointRow } from '@/lib/saath/types';

const NEARBY_RADIUS_M = 20_000;

/** Enterprise keys with no crop of their own — the optional "also on your farm" row. */
const LIVESTOCK_ENTERPRISES = Object.keys(ENTERPRISES).filter(
  (k) => !['paddy', 'sugarcane', 'horticulture', 'ragi'].includes(k),
);

/** Enterprise keys of `theirs` that have an IFS output↔input relationship with `mine`. */
function ifsMatchedEnterprises(mine: string[], theirs: string[]): string[] {
  const out = new Set<string>();
  for (const a of mine) {
    const ai = ENTERPRISES[a];
    if (!ai) continue;
    for (const b of theirs) {
      const bi = ENTERPRISES[b];
      if (!bi) continue;
      const supply = ai.outputs.some((o) => bi.inputs.includes(o));
      const need = bi.outputs.some((o) => ai.inputs.includes(o));
      if (supply || need) out.add(b);
    }
  }
  return [...out];
}

const MANDYA = { lat: 12.5223, lng: 76.8954 };

const LANGUAGES = [
  { code: 'kn', label: 'ಕನ್ನಡ Kannada' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी Hindi' },
  { code: 'ta', label: 'தமிழ் Tamil' },
  { code: 'te', label: 'తెలుగు Telugu' },
];

const field = 'mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm';

const PREVIEW_ICON: Record<string, LucideIcon> = {
  ph: Zap,
  nitrogen: Leaf,
  phosphorus: TestTube2,
  potassium: Sparkles,
  temp: Cloud,
};

const regionalEstimateBadge = (
  <span className="text-[10px] font-semibold text-muted-foreground border border-border/60 rounded-full px-1.5 py-0.5 whitespace-nowrap">
    regional estimate
  </span>
);

interface OnboardingProps {
  /** 'signup' = first-run profile+farm wizard. 'add-farm' = a fully-onboarded
   *  farmer adding (or, with `farmId`, editing) another farm. */
  mode?: 'signup' | 'add-farm';
  farmId?: string;
}

export function Onboarding({ mode = 'signup', farmId }: OnboardingProps = {}) {
  const isAddFarm = mode === 'add-farm';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { refresh, farms, ownFarmer } = useIdentity();

  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.primaryPhoneNumber?.phoneNumber ?? '');
  const [village, setVillage] = useState('');
  const [language, setLanguage] = useState('kn');
  const [role, setRole] = useState<FarmerRole>('farmer');
  const [gstin, setGstin] = useState('');
  const [label, setLabel] = useState('');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(MANDYA);
  const [geo, setGeo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState(
    () => (searchParams.get('invite') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  );
  const [nearby, setNearby] = useState<MapPointRow[]>([]);
  const [locInfo, setLocInfo] = useState<LocationInfo | null>(null);

  // Crop-centric farm setup.
  const [crops, setCrops] = useState<string[]>([]);
  const [plantingDate, setPlantingDate] = useState<Date>();
  const [livestock, setLivestock] = useState<string[]>([]);

  // Live preview of what public data already says about the pinned spot.
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [climate, setClimate] = useState<ClimateData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // "lat,lng" the current soil/climate belong to — so a fresh pin shows a loading
  // state instead of the previous spot's suggestions until its data arrives.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const effectiveRole: FarmerRole = isAddFarm ? ownFarmer?.role ?? 'farmer' : role;
  const isFarmer = effectiveRole === 'farmer' || effectiveRole === 'both';
  const isBuyer = effectiveRole === 'buyer' || effectiveRole === 'both';

  // --- edit prefill (add-farm + farmId) — `farms` already carries every field --
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isAddFarm || !farmId || prefilled.current || farms.length === 0) return;
    const f = farms.find((x) => x.id === farmId);
    if (!f) {
      toast.error('Farm not found');
      navigate('/');
      return;
    }
    prefilled.current = true;
    setPos({ lat: f.lat, lng: f.lng });
    setLabel(f.label);
    setCrops(
      f.primary_crop
        ? [f.primary_crop, ...(f.crops ?? []).filter((c) => c !== f.primary_crop)]
        : f.crops ?? [],
    );
    setLivestock((f.enterprises ?? []).filter((k) => LIVESTOCK_ENTERPRISES.includes(k)));
  }, [isAddFarm, farmId, farms, navigate]);

  useEffect(() => {
    getMapPoints(null)
      .then(setNearby)
      .catch(() => setNearby([]));
  }, []);

  const within = useMemo(() => {
    if (!pos) return [];
    return nearby
      .filter(
        (p) =>
          p.lat != null &&
          p.lng != null &&
          haversineMeters(pos.lat, pos.lng, p.lat, p.lng) <= NEARBY_RADIUS_M,
      )
      .map((p) => ({ ...p, distance_m: haversineMeters(pos.lat, pos.lng, p.lat!, p.lng!) }));
  }, [pos, nearby]);

  // Currency / exchange rate for the pinned coordinate (drives the profit figure).
  useEffect(() => {
    if (!pos) return;
    let alive = true;
    fetchLocationInfo(pos.lat, pos.lng)
      .then((info) => alive && setLocInfo(info))
      .catch(() => alive && setLocInfo(null));
    return () => {
      alive = false;
    };
  }, [pos]);

  // Soil + weather for the pin. Debounced; cached in api.ts so the dashboard reads
  // the same pin as a cache hit afterwards.
  useEffect(() => {
    if (!pos || !isFarmer) return;
    const key = `${pos.lat},${pos.lng}`;
    let alive = true;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      Promise.allSettled([
        fetchSoilData(pos.lat, pos.lng),
        fetchClimateData(pos.lat, pos.lng),
      ]).then(([s, c]) => {
        if (!alive) return;
        if (s.status === 'fulfilled') setSoil(s.value);
        if (c.status === 'fulfilled') setClimate(c.value);
        setLoadedKey(key);
        setPreviewLoading(false);
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pos?.lat, pos?.lng, isFarmer]);

  const suggestionSeason = pos ? getSeason(plantingDate ?? new Date(), pos.lat) : '';

  // Soil/climate in state still belong to a previous pin — treat as "no data yet".
  const previewStale = !!pos && loadedKey !== `${pos.lat},${pos.lng}`;
  const previewBusy = previewLoading || previewStale;

  const cropSuggestions = useMemo(() => {
    if (!isFarmer || !pos || !climate || !soil || previewStale) return [];
    return suggestCropsWithCircular(
      climate,
      soil,
      plantingDate ?? new Date(),
      pos.lat,
      within,
    );
  }, [isFarmer, pos, climate, soil, previewStale, plantingDate, within]);

  // Per-crop indicative estimate — synchronous, reference price only (no mandi).
  const cropEstimates = useMemo(() => {
    if (!isFarmer || !soil || !climate || !pos || !locInfo || previewStale) return [];
    const d = plantingDate ?? new Date();
    return crops.map((cropName) => {
      try {
        const r = calculateYield(cropName, d, climate, soil, pos.lat, locInfo.exchangeRate, 1);
        return {
          crop: cropName,
          pricePerTon: Math.round(r.pricePerUnit),
          profitPerHa: Math.round(r.profit),
        };
      } catch {
        return { crop: cropName, pricePerTon: 0, profitPerHa: 0 };
      }
    });
  }, [crops, isFarmer, soil, climate, pos, locInfo, previewStale, plantingDate]);

  const derivedEnterprises = useMemo(() => {
    const fromCrops = crops
      .map((c) => CROP_TO_ENTERPRISE[c.toLowerCase()])
      .filter((x): x is string => !!x);
    return [...new Set([...fromCrops, ...livestock])];
  }, [crops, livestock]);

  const matchedLabels = useMemo(() => {
    if (!isFarmer || derivedEnterprises.length === 0 || within.length === 0) return [];
    const set = new Set<string>();
    for (const p of within) {
      for (const k of ifsMatchedEnterprises(derivedEnterprises, p.enterprises ?? [])) set.add(k);
    }
    return [...set].slice(0, 2).map(enterpriseLabel);
  }, [within, derivedEnterprises, isFarmer]);

  const sym = locInfo?.currencySymbol ?? '$';

  function toggleCrop(cropName: string) {
    setCrops((prev) =>
      prev.some((c) => c.toLowerCase() === cropName.toLowerCase())
        ? prev.filter((c) => c.toLowerCase() !== cropName.toLowerCase())
        : [...prev, cropName],
    );
  }
  function addCrop(cropName: string) {
    setCrops((prev) =>
      prev.some((c) => c.toLowerCase() === cropName.toLowerCase()) ? prev : [...prev, cropName],
    );
  }
  function removeCrop(cropName: string) {
    setCrops((prev) => prev.filter((c) => c !== cropName));
  }
  function toggleLivestock(k: string) {
    setLivestock((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function geolocate() {
    if (!navigator.geolocation) return;
    setGeo(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeo(false);
      },
      () => setGeo(false),
    );
  }

  /** Location + what's on the farm. */
  function validateFarm(): string | null {
    if (!pos) return 'Pin your farm on the map.';
    if (isFarmer && crops.length === 0) return 'Add at least one crop you grow.';
    if (isBuyer && !isAddFarm && !gstin.trim()) return 'A GSTIN is required for buyers.';
    return null;
  }

  /** Full signup gate — farm + personal. */
  function validateAll(): string | null {
    const f = validateFarm();
    if (f) return f;
    if (!name.trim()) return 'Your name is required.';
    if (!phone.trim()) return 'A phone number is required.';
    if (!village.trim()) return 'Your village is required.';
    return null;
  }

  const canAdvance = !!pos && (!isFarmer || crops.length > 0);

  function goToStep2() {
    const err = validateFarm();
    if (err) {
      toast.error(err);
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToStep1() {
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitSignup() {
    const err = validateAll();
    if (err) {
      toast.error(err);
      if (validateFarm()) setStep(1);
      return;
    }
    setBusy(true);
    try {
      await createProfileWithFarm({
        name: name.trim(),
        phone: phone.trim(),
        village: village.trim(),
        language,
        role,
        enterprises: isFarmer ? derivedEnterprises : [],
        gstin: isBuyer ? gstin.trim() : null,
        lat: pos!.lat,
        lng: pos!.lng,
        farmLabel: village.trim() || 'My farm',
        crops: isFarmer ? crops : [],
        primaryCrop: isFarmer ? crops[0] ?? null : null,
      });
      toast.success('Welcome to TerraLearn');
      // Redeem invite code if the farmer entered one
      const code = inviteCode.trim().toUpperCase();
      if (code) {
        try {
          await redeemInvite(code);
          toast.success(`Joined the farm with invite code ${code}`);
        } catch {
          toast.warning(
            `Invite code "${code}" is invalid or already used — you can join a farm later from the Team tab.`,
          );
        }
      }
      await refresh();
    } catch (e) {
      toast.error(`Could not save your profile: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitFarm() {
    const err = validateFarm();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      if (farmId) {
        await updateFarmDetails({
          farmId,
          lat: pos!.lat,
          lng: pos!.lng,
          label: label.trim() || 'My farm',
          enterprises: derivedEnterprises,
          crops,
          primaryCrop: crops[0] ?? null,
        });
        toast.success('Farm updated');
      } else {
        await addFarm({
          label: label.trim() || 'My farm',
          lat: pos!.lat,
          lng: pos!.lng,
          enterprises: derivedEnterprises,
          crops,
          primaryCrop: crops[0] ?? null,
        });
        toast.success('Farm added');
      }
      await refresh();
      navigate('/');
    } catch (e) {
      toast.error(`Could not save the farm: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const captionFor = (kind: PreviewProvenance): ReactNode => {
    if (kind === 'when-where') return soil ? soilProvenanceLabel(soil) : undefined;
    if (kind === 'weather-grid') return climate ? climateProvenanceLabel() : undefined;
    return undefined;
  };
  const badgeFor = (kind: PreviewProvenance): ReactNode =>
    kind === 'regional-estimate' && soil ? regionalEstimateBadge : undefined;

  const showPreview = isFarmer && (previewBusy || !!soil);

  // -------------------------------------------------------------- shared blocks
  const mapBlock = (
    <div>
      <span className="text-sm text-muted-foreground">Pin your farm</span>
      <div className="mt-1.5">
        <MapView
          value={pos}
          onChange={(lat, lng) => setPos({ lat, lng })}
          onGeolocate={geolocate}
          isGeolocating={geo}
          locationLabel={label || village || 'Your farm'}
          neighbours={within}
          initialView={{ center: [MANDYA.lat, MANDYA.lng], zoom: 11 }}
        />
      </div>
      {within.length > 0 && (
        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
          <span className="font-semibold text-foreground">
            {within.length} {within.length === 1 ? 'farmer' : 'farmers'} registered near you
          </span>
          {matchedLabels.length > 0 && (
            <span className="text-muted-foreground">
              {' '}
              — {matchedLabels.join(' & ')} nearby can trade with your setup.
            </span>
          )}
        </div>
      )}
    </div>
  );

  const cropSection = isFarmer && (
    <div className="space-y-3">
      <div>
        <span className="text-sm text-muted-foreground">When will you plant?</span>
        <div className="mt-1.5">
          <DateSelector date={plantingDate} onDateChange={setPlantingDate} />
        </div>
      </div>

      {previewBusy ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          Reading this spot's soil and climate…
        </div>
      ) : cropSuggestions.length > 0 ? (
        <CropSuggestions
          suggestions={cropSuggestions}
          season={suggestionSeason}
          plantingDate={plantingDate}
          lat={pos?.lat}
          selectedCrops={crops}
          onSelectCrop={toggleCrop}
          show
          variant="panel"
        />
      ) : (
        !!soil && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            No confident crop match for this spot — add one below to simulate it anyway.
          </div>
        )
      )}

      <div>
        <span className="text-sm text-muted-foreground">Add another crop</span>
        <div className="mt-1.5">
          <CropSelector selectedCrop="" onCropChange={(n) => n && addCrop(n)} />
        </div>
      </div>

      {crops.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40">
          {crops.map((c, i) => {
            const est = cropEstimates.find((e) => e.crop === c);
            return (
              <div key={c} className="flex items-start gap-3 px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c}</span>
                    {i === 0 && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                        primary
                      </span>
                    )}
                  </div>
                  {previewBusy ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5 italic">estimating…</p>
                  ) : (
                    est && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {sym}
                        {est.pricePerTon.toLocaleString()}/ton
                        {' · '}
                        {plantingDate ? (
                          <>est. profit {sym}{est.profitPerHa.toLocaleString()}/ha</>
                        ) : (
                          <span className="italic">pick a planting date for a profit estimate</span>
                        )}
                      </p>
                    )
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeCrop(c)}
                  className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                  aria-label={`Remove ${c}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {cropEstimates.length > 0 && (
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground">{INDICATIVE_PRICE_NOTE}</p>
          )}
        </div>
      )}

      <div>
        <span className="text-sm text-muted-foreground">Also on your farm (optional)</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LIVESTOCK_ENTERPRISES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleLivestock(k)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                livestock.includes(k)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              {ENTERPRISES[k].emoji} {ENTERPRISES[k].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const siteDetails = showPreview && (
    <details className="rounded-xl border border-border/60 bg-muted/20 [&_summary]:cursor-pointer">
      <summary className="text-sm font-semibold text-foreground px-4 py-3">
        Site details — soil &amp; weather
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          A regional estimate from public data — not a test of your exact plot.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {previewMetrics(soil, climate).map((m, idx) => (
            <MetricCard
              key={m.key}
              icon={PREVIEW_ICON[m.key]}
              label={m.label}
              value={previewStale ? '—' : m.value}
              unit={m.unit}
              isLoading={previewBusy}
              delay={idx}
              caption={previewStale ? undefined : captionFor(m.provenance)}
              badge={previewStale ? undefined : badgeFor(m.provenance)}
            />
          ))}
        </div>
        {soil && (
          <p className="text-[11px] text-muted-foreground leading-snug">{SOIL_PK_DISCLAIMER}</p>
        )}
      </div>
    </details>
  );

  // ---------------------------------------------------------------- add-farm UI
  if (isAddFarm) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation authSlot={<NavAuthControl />} />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-20 space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold">
              {farmId ? 'Edit farm' : 'Add a farm'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {farmId
                ? 'Update the pin, name and crops for this farm.'
                : 'Another plot under your profile. Your name, phone and village carry over.'}
            </p>
          </div>

          <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-4">
            <label className="text-sm block">
              <span className="text-muted-foreground">Farm name</span>
              <input
                className={field}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="North plot"
              />
            </label>

            {mapBlock}
            {cropSection}
            {siteDetails}

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                disabled={busy}
                className="rounded-lg border border-border/60 px-4 py-2.5 font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitFarm}
                disabled={busy || !canAdvance}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? 'Saving…' : farmId ? 'Save changes' : 'Add farm'}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------- signup wizard
  return (
    <div className="min-h-screen bg-background">
      <Navigation authSlot={<NavAuthControl />} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-20 space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Set up your farm profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This unlocks the simulator and the Saath network. Other farmers see your name,
            village and farm on the map.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {([1, 2] as const).map((n, i) => (
            <div key={n} className="flex items-center gap-3 flex-1 last:flex-none">
              <span
                className={cn(
                  'flex items-center gap-1.5 font-medium',
                  step === n ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full grid place-items-center text-xs',
                    step === n ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {n}
                </span>
                {n === 1 ? 'Your farm' : 'About you'}
              </span>
              {i === 0 && <span className="h-px flex-1 bg-border/60" />}
            </div>
          ))}
        </div>

        <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-4">
          {step === 1 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-muted-foreground">I am a</span>
                  <select
                    className={field}
                    value={role}
                    onChange={(e) => setRole(e.target.value as FarmerRole)}
                  >
                    <option value="farmer">Farmer</option>
                    <option value="buyer">Buyer</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                {isBuyer && (
                  <label className="text-sm">
                    <span className="text-muted-foreground">GSTIN</span>
                    <input
                      className={field}
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="29ABCDE1234F1Z5"
                      maxLength={15}
                    />
                  </label>
                )}
              </div>

              {mapBlock}
              {cropSection}
              {siteDetails}

              <button
                onClick={goToStep2}
                disabled={!canAdvance}
                className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next: about you →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Farm pin</span>
                  <span className="font-medium text-foreground">{pinSummary(pos)}</span>
                </div>
                {isFarmer && crops.length > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Crops</span>
                    <span className="font-medium text-foreground text-right">
                      {crops.join(' · ')}
                    </span>
                  </div>
                )}
                {cropEstimates.map((e) => (
                  <div key={e.crop} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{e.crop} (indicative)</span>
                    <span className="font-medium text-foreground">
                      {sym}
                      {e.pricePerTon.toLocaleString()}/ton
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={backToStep1}
                  className="text-primary hover:underline pt-0.5"
                >
                  ← Edit farm &amp; location
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <input
                    className={field}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91…"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Village</span>
                  <input
                    className={field}
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Preferred language</span>
                  <select
                    className={field}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Invite code — optional, spans full width below the 2-col grid */}
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-1.5">
                <label className="text-sm block">
                  <span className="font-medium text-foreground">Have an invite code?</span>
                  <span className="ml-2 text-xs text-muted-foreground">Optional — if a farm owner gave you one</span>
                  <input
                    className={`${field} mt-1.5 font-mono tracking-widest uppercase`}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="e.g. A3F9C2"
                    maxLength={8}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Entering a valid code joins you as a member of that farm immediately after sign-up.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={backToStep1}
                  disabled={busy}
                  className="rounded-lg border border-border/60 px-4 py-2.5 font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={submitSignup}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Finish setup'}
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
