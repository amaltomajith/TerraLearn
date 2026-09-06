import { useState } from 'react';
import { toast } from 'sonner';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useRealtimeOffers } from '@/lib/saath/useRealtimeOffers';
import { createOffer, setOfferStatus, createExchange } from '@/lib/saath/queries';
import { cn } from '@/lib/utils';
import { ExchangePanel } from './ExchangePanel';

/**
 * Offer / counter-offer chain on one supply listing.
 * sellerId owns the listing; buyerId is negotiating.
 */
export function OfferThread({
  listingId,
  sellerId,
  sellerName,
  buyerId,
  buyerName,
}: {
  listingId: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
}) {
  const { activeFarmerId } = useSaathIdentity();
  const { offers, reload } = useRealtimeOffers(listingId);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);

  const isSeller = activeFarmerId === sellerId;
  const isBuyer = activeFarmerId === buyerId;
  const last = offers[offers.length - 1];
  const accepted = offers.some((o) => o.status === 'accepted');

  async function submitOffer(isCounter: boolean) {
    if (!activeFarmerId || !price) return;
    setBusy(true);
    try {
      if (isCounter && last) await setOfferStatus(last.id, 'countered');
      await createOffer({
        listing_id: listingId,
        from_farmer_id: activeFarmerId,
        price: Number(price),
        quantity: qty ? Number(qty) : last?.quantity ?? null,
        parent_offer_id: isCounter && last ? last.id : null,
      });
      setPrice('');
      setQty('');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!last) return;
    setBusy(true);
    try {
      await setOfferStatus(last.id, 'accepted');
      await createExchange({
        listing_id: listingId,
        offer_id: last.id,
        requester_id: buyerId,
        provider_id: sellerId,
        is_ifs_exchange: false,
      });
      toast.success('Offer accepted — exchange created');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canActOnLast =
    last && last.status !== 'accepted' && last.from_farmer_id !== activeFarmerId && (isSeller || isBuyer);

  const input = 'rounded-lg border border-border/60 bg-background px-2 py-1.5 text-sm w-24';

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <p className="text-sm font-semibold">
        Negotiation · {buyerName} ↔ {sellerName}
      </p>

      <ol className="space-y-1.5">
        {offers.map((o) => (
          <li key={o.id} className="flex items-center justify-between text-sm">
            <span>
              <span className="font-mono font-semibold">₹{o.price}</span>
              {o.quantity ? <span className="text-muted-foreground"> × {o.quantity}</span> : null}
              <span className="text-xs text-muted-foreground">
                {' '}
                — {o.from_farmer_id === buyerId ? buyerName : sellerName}
              </span>
            </span>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                o.status === 'accepted'
                  ? 'bg-accent/15 text-accent'
                  : o.status === 'countered'
                    ? 'bg-secondary/15 text-secondary'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {o.status}
            </span>
          </li>
        ))}
      </ol>

      {!accepted && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={input}
            type="number"
            placeholder="₹ price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            className={input}
            type="number"
            placeholder="qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {offers.length === 0 ? (
            <button
              onClick={() => submitOffer(false)}
              disabled={busy || !price}
              className="rounded-lg bg-primary px-3 h-8 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Send offer
            </button>
          ) : (
            <button
              onClick={() => submitOffer(true)}
              disabled={busy || !price}
              className="rounded-lg bg-secondary px-3 h-8 text-xs font-semibold text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50"
            >
              Counter
            </button>
          )}
          {canActOnLast && (
            <button
              onClick={accept}
              disabled={busy}
              className="rounded-lg bg-accent px-3 h-8 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              Accept ₹{last?.price}
            </button>
          )}
        </div>
      )}

      {accepted && (
        <ExchangePanel
          otherId={isSeller ? buyerId : sellerId}
          otherName={isSeller ? buyerName : sellerName}
          otherIsBuyer={isSeller}
          listingId={listingId}
        />
      )}
    </div>
  );
}
