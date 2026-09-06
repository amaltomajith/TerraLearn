import { useParams } from 'react-router-dom';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getFarmer, getCircularBadge, getRatingsFor, getMyListings } from '@/lib/saath/queries';
import type { CircularBadge as BadgeTier } from '@/lib/saath/types';
import { describeEnterprises } from '@/lib/saath/ifsMatrix';
import { SectionCard, EmptyState, CircularBadge, StarRow } from './primitives';
import { ReliabilityScore } from './ReliabilityScore';

export function ProfilePage() {
  const { farmerId } = useParams();
  const { activeFarmerId } = useSaathIdentity();
  const id = farmerId ?? activeFarmerId;

  const { data: farmer, loading } = useAsync(
    () => (id ? getFarmer(id) : Promise.resolve(null)),
    [id],
  );
  const { data: badge } = useAsync(
    () => (id ? getCircularBadge(id) : Promise.resolve('none')),
    [id],
  );
  const { data: ratings } = useAsync(
    () => (id ? getRatingsFor(id) : Promise.resolve([])),
    [id],
  );
  const { data: listings } = useAsync(
    () => (id ? getMyListings(id) : Promise.resolve([])),
    [id],
  );

  if (loading) return <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />;
  if (!farmer) return <EmptyState>Profile not found.</EmptyState>;

  const isBuyer = farmer.role === 'buyer' || farmer.role === 'both';

  return (
    <div className="space-y-4 max-w-3xl">
      <SectionCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{farmer.name}</h1>
            <p className="text-sm text-muted-foreground">
              {farmer.village ?? 'Location not set'} ·{' '}
              {farmer.role === 'buyer' ? 'Buyer' : describeEnterprises(farmer.enterprises)}
            </p>
          </div>
          <CircularBadge tier={(badge ?? 'none') as BadgeTier} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <ReliabilityScore
            farmerId={farmer.id}
            label={isBuyer ? 'Payment reliability' : 'Reliability'}
          />
          {isBuyer && farmer.gstin && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">GSTIN</span>
              <span className="font-mono">{farmer.gstin}</span>
              <span
                className={
                  farmer.gstin_verified
                    ? 'text-accent font-semibold'
                    : 'text-secondary font-semibold'
                }
              >
                {farmer.gstin_verified ? 'verified' : 'unverified'}
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Active listings">
        {listings && listings.filter((l) => l.is_active).length === 0 && (
          <EmptyState>No active listings.</EmptyState>
        )}
        <div className="space-y-2">
          {(listings ?? [])
            .filter((l) => l.is_active)
            .map((l) => (
              <div key={l.id} className="rounded-xl border border-border/60 p-3">
                <p className="font-semibold text-sm">{l.title}</p>
                <p className="text-xs text-muted-foreground">
                  {l.type}
                  {l.category ? ` · ${l.category}` : ''}
                </p>
              </div>
            ))}
        </div>
      </SectionCard>

      <SectionCard title={`Ratings (${ratings?.length ?? 0})`}>
        {ratings && ratings.length === 0 && <EmptyState>No ratings yet.</EmptyState>}
        <div className="space-y-2">
          {(ratings ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <StarRow value={r.reliability_score ?? 0} readOnly />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.note && <p className="text-xs text-muted-foreground mt-1">{r.note}</p>}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
