import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { useAsync } from '@/lib/saath/useAsync';
import { getMyDisputes, resolveDispute } from '@/lib/saath/queries';
import { SectionCard, EmptyState } from './primitives';

export function DisputesPanel() {
  const { data, loading, reload } = useAsync(() => getMyDisputes(), []);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string) {
    setBusy(id);
    try {
      await resolveDispute(id, note[id]?.trim() || 'Resolved by mutual agreement.');
      toast.success('Dispute resolved');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Disputes
        </span>
      }
    >
      <p className="text-xs text-muted-foreground mb-4">
        Disputes raised on exchanges you are part of. Either party can add a resolution note
        and close it.
      </p>
      {loading && <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />}
      {data && data.length === 0 && <EmptyState>No disputes.</EmptyState>}
      <div className="space-y-2">
        {(data ?? []).map((d) => (
          <div key={d.id} className="rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <span
                className={
                  d.status === 'open'
                    ? 'text-xs font-semibold text-destructive'
                    : 'text-xs font-semibold text-accent'
                }
              >
                {d.status}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(d.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm mt-1">{d.reason}</p>
            {d.resolution_note && (
              <p className="text-xs text-muted-foreground mt-1">
                Resolution: {d.resolution_note}
              </p>
            )}
            {d.status === 'open' && (
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs"
                  placeholder="Resolution note"
                  value={note[d.id] ?? ''}
                  onChange={(e) => setNote((n) => ({ ...n, [d.id]: e.target.value }))}
                />
                <button
                  onClick={() => resolve(d.id)}
                  disabled={busy === d.id}
                  className="rounded-lg bg-primary px-3 h-8 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Resolve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
