import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MapView } from '@/components/MapView';
import { useSaathIdentity } from './SaathIdentityProvider';
import { postListing } from '@/lib/saath/queries';
import { ENTERPRISES } from '@/lib/saath/ifsMatrix';
import type { ListingType } from '@/lib/saath/types';
import { SectionCard } from './primitives';
import { IfsMatchPanel } from './IfsMatchPanel';

const MANDYA = { lat: 12.5223, lng: 76.8954 };

const RESOURCE_OPTIONS = Array.from(
  new Set(Object.values(ENTERPRISES).flatMap((e) => e.outputs)),
).sort();

export function ListingComposer() {
  const { activeFarmerId } = useSaathIdentity();
  const navigate = useNavigate();

  const [type, setType] = useState<ListingType>('resource');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [ifsResource, setIfsResource] = useState('');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(MANDYA);
  const [geo, setGeo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState<{ resource: string } | null>(null);

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

  async function submit() {
    if (!activeFarmerId || !title.trim() || !pos) {
      toast.error('Title and a pinned location are required.');
      return;
    }
    setBusy(true);
    try {
      await postListing({
        farmer_id: activeFarmerId,
        type,
        category: category.trim() || ifsResource || null,
        title: title.trim(),
        description: description.trim() || null,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        rate: rate ? Number(rate) : null,
        ifs_resource_type: ifsResource || null,
        lat: pos.lat,
        lng: pos.lng,
      });
      toast.success('Listing posted');
      if (type === 'resource' && ifsResource) {
        setPosted({ resource: ifsResource });
      } else {
        navigate('/saath/feed');
      }
    } catch (e) {
      toast.error(`Could not post: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const input =
    'mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SectionCard title="Post a listing">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted-foreground">Type</span>
              <select
                className={input}
                value={type}
                onChange={(e) => setType(e.target.value as ListingType)}
              >
                <option value="resource">Resource / by-product</option>
                <option value="equipment">Equipment</option>
                <option value="labour">Labour</option>
                <option value="demand">Demand (I need something)</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Category</span>
              <input
                className={input}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. paddy straw, tractor, vegetables"
              />
            </label>
          </div>

          <label className="text-sm block">
            <span className="text-muted-foreground">Title</span>
            <input
              className={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="800 kg paddy straw available after harvest"
            />
          </label>

          <label className="text-sm block">
            <span className="text-muted-foreground">Description</span>
            <textarea
              className={input}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <input
                className={input}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Unit</span>
              <input
                className={input}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg, ton, load, hr"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Rate ₹ (optional)</span>
              <input
                className={input}
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
          </div>

          {type === 'resource' && (
            <label className="text-sm block">
              <span className="text-muted-foreground">
                IFS resource type — powers circular matching
              </span>
              <select
                className={input}
                value={ifsResource}
                onChange={(e) => setIfsResource(e.target.value)}
              >
                <option value="">Not an IFS by-product</option>
                {RESOURCE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <span className="text-sm text-muted-foreground">Location</span>
            <div className="mt-1.5">
              <MapView
                value={pos}
                onChange={(lat, lng) => setPos({ lat, lng })}
                onGeolocate={geolocate}
                isGeolocating={geo}
                locationLabel="Listing location"
                initialView={{ center: [MANDYA.lat, MANDYA.lng], zoom: 12 }}
              />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post listing'}
          </button>
        </div>
      </SectionCard>

      {posted && (
        <>
          <IfsMatchPanel resource={posted.resource} />
          <button
            onClick={() => navigate('/saath/feed')}
            className="w-full rounded-lg border border-border/60 px-4 py-2 text-sm font-medium hover:bg-muted/40"
          >
            Done — back to feed
          </button>
        </>
      )}
    </div>
  );
}
