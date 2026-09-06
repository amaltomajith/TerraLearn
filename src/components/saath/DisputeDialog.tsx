import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { raiseDispute } from '@/lib/saath/queries';

export function RaiseDisputeButton({
  exchangeId,
  raisedBy,
}: {
  exchangeId: string;
  raisedBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await raiseDispute({ exchange_id: exchangeId, raised_by: raisedBy, reason: reason.trim() });
      toast.success('Dispute raised — a KVK coordinator will follow up.');
      setOpen(false);
      setReason('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
      >
        <AlertTriangle className="w-3 h-3" /> Raise a dispute
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/[0.04] p-3 space-y-2">
      <textarea
        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
        rows={2}
        placeholder="What went wrong?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-destructive px-3 h-7 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50"
        >
          Submit
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-border/60 px-3 h-7 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
