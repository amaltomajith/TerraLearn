import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { Cloud, Leaf, Sparkles, TestTube2, Zap, type LucideIcon } from 'lucide-react';
import { Navigation } from './Navigation';
import NavAuthControl from './saath/NavAuthControl';
import { MapView } from './MapView';
import { MetricCard } from './MetricCard';
import { ENTERPRISES, enterpriseLabel } from '@/lib/saath/ifsMatrix';
import { createProfileWithFarm, getMapPoints } from '@/lib/saath/queries';
import { haversineMeters } from '@/lib/saath/distance';
import { useIdentity } from '@/lib/identity/identity';
import { cn } from '@/lib/utils';
import {
  fetchLocationInfo,
  fetchSoilData,
  fetchClimateData,
  type LocationInfo,
  type SoilData,
  type ClimateData,
} from '@/lib/api';
import { indicativePrices, INDICATIVE_PRICE_NOTE } from '@/lib/enterpriseReference';
import {
  soilProvenanceLabel,
  climateProvenanceLabel,
  SOIL_PK_DISCLAIMER,
} from '@/lib/dataProvenance';
import {
  previewMetrics,
  enterpriseSummary,
  pinSummary,
  type PreviewProvenance,
} from '@/lib/onboardingPreview';
import type { FarmerRole, MapPointRow } from '@/lib/saath/types';

const NEARBY_RADIUS_M = 20_000;

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

export function Onboarding() {
  const { user } = useUser();
  const { refresh } = useIdentity();

  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.primaryPhoneNumber?.phoneNumber ?? '');
  const [village, setVillage] = useState('');
  const [language, setLanguage] = useState('kn');
  const [role, setRole] = useState<FarmerRole>('farmer');
  const [enterprises, setEnterprises] = useState<string[]>([]);
  const [gstin, setGstin] = useState('');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(MANDYA);
  const [geo, setGeo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nearby, setNearby] = useState<MapPointRow[]>([]);
  const [locInfo, setLocInfo] = useState<LocationInfo | null>(null);

  // Live preview of what public data already says about the pinned spot.
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [climate, setClimate] = useState<ClimateData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isFarmer = role === 'farmer' || role === 'both';
  const isBuyer = role === 'buyer' || role === 'both';

  useEffect(() => {
    getMapPoints(null)
      .then(setNearby)
      .catch(() => setNearby([]));
  }, []);

  const within = useMemo(() => {
    if (!pos) return [];
    return nearby.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        haversineMeters(pos.lat, pos.lng, p.lat, p.lng) <= NEARBY_RADIUS_M,
    );
  }, [pos, nearby]);

  // Currency / exchange rate for the pinned coordinate, so the indicative price
  // line can be shown in the farmer's local currency. Cached in `api.ts`.
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

  // Soil + weather preview for the pin. Debounced so dragging the marker doesn't
  // spam the APIs; all fetchers are cached in `api.ts`, so the dashboard reads
  // the same pin as a cache hit after onboarding.
  useEffect(() => {
    if (!pos || !isFarmer) return;
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
        setPreviewLoading(false);
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pos?.lat, pos?.lng, isFarmer]);

  const priceRows = useMemo(() => {
    if (!isFarmer || !locInfo || enterprises.length === 0) return [];
    return indicativePrices(
      enterprises,
      locInfo.exchangeRate,
      locInfo.currencySymbol,
      enterpriseLabel,
    );
  }, [isFarmer, locInfo, enterprises]);

  const matchedLabels = useMemo(() => {
    if (!isFarmer || enterprises.length === 0 || within.length === 0) return [];
    const set = new Set<string>();
    for (const p of within) {
      for (const k of ifsMatchedEnterprises(enterprises, p.enterprises ?? [])) set.add(k);
    }
    return [...set].slice(0, 2).map(enterpriseLabel);
  }, [within, enterprises, isFarmer]);

  function toggleEnterprise(k: string) {
    setEnterprises((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
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

  /** Step 1 ("your farm") gate — location + what's on it. */
  function validateStep1(): string | null {
    if (!pos) return 'Pin your farm on the map.';
    if (isFarmer && enterprises.length === 0)
      return 'Pick at least one enterprise on your farm.';
    if (isBuyer && !gstin.trim()) return 'A GSTIN is required for buyers.';
    return null;
  }

  /** Full profile gate — everything, run at submit. */
  function validate(): string | null {
    const s1 = validateStep1();
    if (s1) return s1;
    if (!name.trim()) return 'Your name is required.';
    if (!phone.trim()) return 'A phone number is required.';
    if (!village.trim()) return 'Your village is required.';
    return null;
  }

  const canAdvance = !!pos && (!isFarmer || enterprises.length > 0);

  function goToStep2() {
    const err = validateStep1();
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

  async function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
      if (validateStep1()) setStep(1);
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
        enterprises: isFarmer ? enterprises : [],
        gstin: isBuyer ? gstin.trim() : null,
        lat: pos!.lat,
        lng: pos!.lng,
        farmLabel: village.trim() || 'My farm',
      });
      toast.success('Welcome to TerraLearn');
      await refresh();
    } catch (e) {
      toast.error(`Could not save your profile: ${(e as Error).message}`);
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

  const showPreview = isFarmer && (previewLoading || !!soil);

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

        {/* Progress */}
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

              <div>
                <span className="text-sm text-muted-foreground">Pin your farm</span>
                <div className="mt-1.5">
                  <MapView
                    value={pos}
                    onChange={(lat, lng) => setPos({ lat, lng })}
                    onGeolocate={geolocate}
                    isGeolocating={geo}
                    locationLabel={village || 'Your farm'}
                    neighbours={within}
                    initialView={{ center: [MANDYA.lat, MANDYA.lng], zoom: 11 }}
                  />
                </div>
                {within.length > 0 && (
                  <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
                    <span className="font-semibold text-foreground">
                      {within.length} {within.length === 1 ? 'farmer' : 'farmers'} registered
                      near you
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

              {isFarmer && (
                <div>
                  <span className="text-sm text-muted-foreground">Enterprises on your farm</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.values(ENTERPRISES).map((e) => (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => toggleEnterprise(e.key)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          enterprises.includes(e.key)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/60 text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {e.emoji} {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showPreview && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      What we can already see for this spot
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      A regional estimate from public data — not a test of your exact plot.
                      You can refine this later.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {previewMetrics(soil, climate).map((m, idx) => (
                      <MetricCard
                        key={m.key}
                        icon={PREVIEW_ICON[m.key]}
                        label={m.label}
                        value={m.value}
                        unit={m.unit}
                        isLoading={previewLoading && !soil}
                        delay={idx}
                        caption={captionFor(m.provenance)}
                        badge={badgeFor(m.provenance)}
                      />
                    ))}
                  </div>
                  {soil && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {SOIL_PK_DISCLAIMER}
                    </p>
                  )}
                  {priceRows.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
                      <div className="space-y-0.5">
                        {priceRows.map((p) => (
                          <div key={p.enterpriseKey} className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{p.label}</span>
                            <span className="font-medium text-foreground">
                              {p.currencySymbol}
                              {p.perTonLocal.toLocaleString()} / ton
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {INDICATIVE_PRICE_NOTE}
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                {isFarmer && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Enterprises</span>
                    <span className="font-medium text-foreground text-right">
                      {enterpriseSummary(enterprises.map(enterpriseLabel))}
                    </span>
                  </div>
                )}
                {priceRows.map((p) => (
                  <div key={p.enterpriseKey} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{p.label} (indicative)</span>
                    <span className="font-medium text-foreground">
                      {p.currencySymbol}
                      {p.perTonLocal.toLocaleString()} / ton
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
                  <input
                    className={field}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
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

              <div className="flex gap-3">
                <button
                  onClick={backToStep1}
                  disabled={busy}
                  className="rounded-lg border border-border/60 px-4 py-2.5 font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={submit}
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
