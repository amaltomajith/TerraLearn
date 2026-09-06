import { useState } from 'react';
import { toast } from 'sonner';
import { submitRating } from '@/lib/saath/queries';
import { StarRow } from './primitives';

export function RatingDialog({
  exchangeId,
  raterId,
  ratedId,
  ratedName,
  isBuyerRated,
  onDone,
}: {
  exchangeId: string;
  raterId: string;
  ratedId: string;
  ratedName: string;
  isBuyerRated?: boolean;
  onDone: () => void;
}) {
  const [reliability, setReliability] = useState(5);
  const [condition, setCondition] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await submitRating({
        exchange_id: exchangeId,
        rater_id: raterId,
        rated_id: ratedId,
        reliability_score: reliability,
        condition_score: isBuyerRated ? null : condition,
        communication_score: communication,
        note: note.trim() || null,
      });
      toast.success('Rating submitted');
      onDone();
    } catch (e) {
      toast.error(`Could not submit rating: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <p className="font-semibold text-sm">Rate {ratedName}</p>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isBuyerRated ? 'Payment reliability' : 'Reliability'}
        </span>
        <StarRow value={reliability} onChange={setReliability} />
      </div>
      {!isBuyerRated && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Condition / quality</span>
          <StarRow value={condition} onChange={setCondition} />
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Communication</span>
        <StarRow value={communication} onChange={setCommunication} />
      </div>

      <textarea
        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
        rows={2}
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Submit rating'}
      </button>
    </div>
  );
}
