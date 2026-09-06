import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { Navigation } from './Navigation';
import NavAuthControl from './saath/NavAuthControl';
import { MapView } from './MapView';
import { ENTERPRISES, enterpriseLabel } from '@/lib/saath/ifsMatrix';
import { createProfileWithFarm, getMapPoints } from '@/lib/saath/queries';
import { haversineMeters } from '@/lib/saath/distance';
import { useIdentity } from '@/lib/identity/identity';
import { cn } from '@/lib/utils';
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

export function Onboarding() {
  const { user } = useUser();
  const { refresh } = useIdentity();

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

  function validate(): string | null {
    if (!name.trim()) return 'Your name is required.';
    if (!phone.trim()) return 'A phone number is required.';
    if (!village.trim()) return 'Your village is required.';
    if (!pos) return 'Pin your farm on the map.';
    if (isFarmer && enterprises.length === 0)
      return 'Pick at least one enterprise on your farm.';
    if (isBuyer && !gstin.trim()) return 'A GSTIN is required for buyers.';
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
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

        <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-4">
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

          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Finish setup'}
          </button>
        </section>
      </main>
    </div>
  );
}
