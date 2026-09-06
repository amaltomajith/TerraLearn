import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import {
  getMyListings,
  postListing,
  supplyMatchesForDemand,
} from '@/lib/saath/queries';
import { formatDistance } from '@/lib/saath/distance';
import { SectionCard, EmptyState } from './primitives';
import { OfferThread } from './OfferThread';
import { ReliabilityScore } from './ReliabilityScore';

const MANDYA = { lat: 12.5223, lng: 76.8954 };

export function BuyerPage() {
  const { activeFarmer, activeFarmerId } = useSaathIdentity();
  const isBuyer = activeFarmer?.role === 'buyer' || activeFarmer?.role === 'both';

  const { data: listings, reload } = useAsync(
    () => (activeFarmerId ? getMyListings(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId],
  );
  const demands = (listings ?? []).filter((l) => l.type === 'demand');

  return (
    <div className="space-y-4 max-w-3xl">
      {!isBuyer && (
        <SectionCard>
          <p className="text-sm text-muted-foreground">
            The buyer desk is for buyer accounts. Set your role to “Buyer” or “Both” in your
            profile to post demand and negotiate offers.
          </p>
        </SectionCard>
      )}

      {isBuyer && activeFarmerId && (
        <>
          <SectionCard title="Your payment standing">
            <ReliabilityScore farmerId={activeFarmerId} label="Payment reliability" />
            <p className="text-xs text-muted-foreground mt-2">
              Farmers see this before dealing with you. It updates every time a completed sale is
              rated.
            </p>
          </SectionCard>

          <DemandComposer onPosted={reload} />

          {demands.length === 0 && (
            <SectionCard>
              <EmptyState>No open demand. Post one above.</EmptyState>
            </SectionCard>
          )}

          {demands.map((d) => (
            <DemandMatches
              key={d.id}
              demandId={d.id}
              demandTitle={d.title}
              buyerId={activeFarmerId}
              buyerName={activeFarmer?.name ?? 'You'}
            />
          ))}
        </>
      )}
    </div>
  );
}

function DemandComposer({ onPosted }: { onPosted: () => void }) {
  const { activeFarmerId } = useSaathIdentity();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!activeFarmerId || !title.trim() || !category.trim()) {
      toast.error('Title and category are required (category drives matching).');
      return;
    }
    setBusy(true);
    try {
      await postListing({
        farmer_id: activeFarmerId,
        type: 'demand',
        category: category.trim(),
        title: title.trim(),
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        rate: rate ? Number(rate) : null,
        lat: MANDYA.lat,
        lng: MANDYA.lng,
      });
      toast.success('Demand posted');
      setTitle('');
      setCategory('');
      setQuantity('');
      setUnit('');
      setRate('');
      onPosted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = 'rounded-lg border border-border/60 bg-background px-3 py-2 text-sm w-full';

  return (
    <SectionCard title="Post demand">
      <div className="space-y-3">
        <input
          className={input}
          placeholder="Title — e.g. Silk cocoons wanted, 200 kg by Oct 20"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            className={input}
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            className={input}
            type="number"
            placeholder="Qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input
            className={input}
            placeholder="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <input
            className={input}
            type="number"
            placeholder="₹ target"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {busy ? 'Posting…' : 'Post demand'}
        </button>
      </div>
    </SectionCard>
  );
}

function DemandMatches({
  demandId,
  demandTitle,
  buyerId,
  buyerName,
}: {
  demandId: string;
  demandTitle: string;
  buyerId: string;
  buyerName: string;
}) {
  const { data: matches, loading } = useAsync(
    () => supplyMatchesForDemand(demandId),
    [demandId],
  );
  const [openListing, setOpenListing] = useState<string | null>(null);

  return (
    <SectionCard title={`Matches for “${demandTitle}”`}>
      {loading && <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />}
      {matches && matches.length === 0 && (
        <EmptyState>No matching supply listings within 100 km.</EmptyState>
      )}
      <div className="space-y-2">
        {(matches ?? []).map((m) => (
          <div key={m.listing_id} className="rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.farmer_name}
                  {m.village ? ` · ${m.village}` : ''} · {formatDistance(m.distance_m)}
                  {m.rate != null ? ` · asking ₹${m.rate}${m.unit ? '/' + m.unit : ''}` : ''}
                </p>
              </div>
              <button
                onClick={() =>
                  setOpenListing(openListing === m.listing_id ? null : m.listing_id)
                }
                className="rounded-lg bg-primary px-3 h-8 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {openListing === m.listing_id ? 'Hide' : 'Negotiate'}
              </button>
            </div>
            {openListing === m.listing_id && (
              <div className="mt-3">
                <OfferThread
                  listingId={m.listing_id}
                  sellerId={m.farmer_id}
                  sellerName={m.farmer_name}
                  buyerId={buyerId}
                  buyerName={buyerName}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
