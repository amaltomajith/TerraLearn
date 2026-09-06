import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Handshake } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import {
  createExchange,
  getExchangesFor,
  getRatingsByExchange,
  markIfsComplete,
  confirmPayment,
} from '@/lib/saath/queries';
import type { Exchange } from '@/lib/saath/types';
import { RatingDialog } from './RatingDialog';
import { RaiseDisputeButton } from './DisputeDialog';

export function ExchangePanel({
  otherId,
  otherName,
  otherIsBuyer,
  listingId,
}: {
  otherId: string;
  otherName: string;
  otherIsBuyer?: boolean;
  listingId?: string | null;
}) {
  const { activeFarmerId } = useSaathIdentity();
  const [ifs, setIfs] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data: exchanges, reload } = useAsync(
    () => (activeFarmerId ? getExchangesFor(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId],
  );

  const exchange: Exchange | undefined = useMemo(() => {
    return (exchanges ?? []).find(
      (e) =>
        (e.requester_id === otherId && e.provider_id === activeFarmerId) ||
        (e.provider_id === otherId && e.requester_id === activeFarmerId),
    );
  }, [exchanges, otherId, activeFarmerId]);

  const { data: ratings, reload: reloadRatings } = useAsync(
    () => (exchange ? getRatingsByExchange(exchange.id) : Promise.resolve([])),
    [exchange?.id],
  );
  const iRated = (ratings ?? []).some((r) => r.rater_id === activeFarmerId);

  async function start() {
    if (!activeFarmerId) return;
    setBusy(true);
    try {
      await createExchange({
        requester_id: activeFarmerId,
        provider_id: otherId,
        is_ifs_exchange: ifs,
        listing_id: listingId ?? null,
      });
      toast.success('Exchange started');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!exchange) return;
    setBusy(true);
    try {
      await markIfsComplete(exchange.id);
      toast.success('Marked complete');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pay(side: 'payer' | 'payee') {
    if (!exchange) return;
    setBusy(true);
    try {
      await confirmPayment(exchange.id, side);
      toast.success('Payment confirmed');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!activeFarmerId) return null;

  if (!exchange) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Handshake className="w-4 h-4 text-primary" /> Agreed terms?
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={ifs} onChange={(e) => setIfs(e.target.checked)} />
          This is a circular / IFS exchange (counts toward the circular badge)
        </label>
        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-primary px-3 h-8 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Start exchange
        </button>
      </div>
    );
  }

  const isProvider = exchange.provider_id === activeFarmerId;
  const done = exchange.completed_at != null;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {exchange.is_ifs_exchange ? 'Circular exchange' : 'Marketplace exchange'}
        </p>
        {done ? (
          <span className="text-xs font-semibold text-accent flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">In progress</span>
        )}
      </div>

      {!done && exchange.is_ifs_exchange && (
        <button
          onClick={complete}
          disabled={busy}
          className="rounded-lg bg-primary px-3 h-8 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Mark exchange complete
        </button>
      )}

      {!done && !exchange.is_ifs_exchange && (
        <div className="space-y-1.5 text-xs">
          <ConfirmRow
            label="Payer confirmed payment sent"
            checked={exchange.payment_confirmed_by_payer}
            onConfirm={() => pay('payer')}
            canConfirm={!isProvider && !exchange.payment_confirmed_by_payer}
            busy={busy}
          />
          <ConfirmRow
            label="Payee confirmed payment received"
            checked={exchange.payment_confirmed_by_payee}
            onConfirm={() => pay('payee')}
            canConfirm={isProvider && !exchange.payment_confirmed_by_payee}
            busy={busy}
          />
        </div>
      )}

      {done && !iRated && (
        <RatingDialog
          exchangeId={exchange.id}
          raterId={activeFarmerId}
          ratedId={otherId}
          ratedName={otherName}
          isBuyerRated={otherIsBuyer}
          onDone={reloadRatings}
        />
      )}
      {done && iRated && (
        <p className="text-xs text-muted-foreground">You have rated this exchange.</p>
      )}

      <RaiseDisputeButton exchangeId={exchange.id} raisedBy={activeFarmerId} />
    </div>
  );
}

function ConfirmRow({
  label,
  checked,
  onConfirm,
  canConfirm,
  busy,
}: {
  label: string;
  checked: boolean;
  onConfirm: () => void;
  canConfirm: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5">
        {checked ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground/50" />
        )}
        {label}
      </span>
      {canConfirm && (
        <button
          onClick={onConfirm}
          disabled={busy}
          className="rounded-md bg-primary px-2 h-6 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Confirm
        </button>
      )}
    </div>
  );
}
