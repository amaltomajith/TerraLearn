import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getMyListings, setListingActive } from '@/lib/saath/queries';
import { SectionCard, EmptyState } from './primitives';

export function MyListingsPage() {
  const { activeFarmerId } = useSaathIdentity();
  const { data, loading, reload } = useAsync(
    () => (activeFarmerId ? getMyListings(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId],
  );

  async function toggle(id: string, active: boolean) {
    try {
      await setListingActive(id, active);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <SectionCard
      title="My listings"
      action={
        <Link
          to="/saath/listings/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New
        </Link>
      }
    >
      {loading && <div className="h-20 rounded-xl bg-muted/40 animate-pulse" />}
      {data && data.length === 0 && <EmptyState>You have no listings yet.</EmptyState>}
      <div className="space-y-2">
        {(data ?? []).map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between rounded-xl border border-border/60 p-3"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{l.title}</p>
              <p className="text-xs text-muted-foreground">
                {l.type}
                {l.category ? ` · ${l.category}` : ''}
                {l.quantity != null ? ` · ${l.quantity}${l.unit ? ' ' + l.unit : ''}` : ''}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <input
                type="checkbox"
                checked={l.is_active}
                onChange={(e) => toggle(l.id, e.target.checked)}
              />
              Active
            </label>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
