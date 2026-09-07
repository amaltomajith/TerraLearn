import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getFeed } from '@/lib/saath/queries';
import type { ListingType } from '@/lib/saath/types';
import { ListingCard } from './ListingCard';
import { CircularLoopsPanel } from './CircularLoopsPanel';
import { SectionCard, EmptyState } from './primitives';
import { cn } from '@/lib/utils';

const FILTERS: { label: string; value: ListingType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Resources', value: 'resource' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Labour', value: 'labour' },
  { label: 'Demand', value: 'demand' },
];

export function FeedPage() {
  const { activeFarmerId } = useSaathIdentity();
  const [filter, setFilter] = useState<ListingType | 'all'>('all');

  const { data, loading, error } = useAsync(
    () =>
      activeFarmerId
        ? getFeed(activeFarmerId, filter === 'all' ? undefined : filter)
        : Promise.resolve([]),
    [activeFarmerId, filter],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
      <div className="space-y-4">
        <SectionCard
          title="Nearby listings"
          action={
            <Link
              to="/saath/listings/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Post a listing
            </Link>
          }
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filter === f.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && !data && (
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}
          {data && data.length === 0 && (
            <EmptyState>No listings within 20 km for this filter.</EmptyState>
          )}
          {data && data.length > 0 && (
            <div className="space-y-1.5">
              {data.map((row) => (
                <ListingCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-4">
        <CircularLoopsPanel />
      </div>
    </div>
  );
}
