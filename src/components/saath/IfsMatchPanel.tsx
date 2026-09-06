import { ArrowRight, Sparkles } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getIfsLoops } from '@/lib/saath/queries';
import { formatDistance } from '@/lib/saath/distance';
import { enterpriseEmoji } from '@/lib/saath/ifsMatrix';
import { EmptyState } from './primitives';
import { ConnectionRequestButton } from './ConnectionRequestButton';

/** Shown right after a resource listing is posted: who can use this resource. */
export function IfsMatchPanel({ resource }: { resource: string }) {
  const { activeFarmerId } = useSaathIdentity();
  const { data, loading } = useAsync(
    () => (activeFarmerId ? getIfsLoops(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId, resource],
  );

  const matches = (data ?? []).filter(
    (m) => m.direction === 'i_supply' && m.resource === resource,
  );

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="font-serif font-bold text-foreground">
          Circular matches for “{resource}”
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Surfaced automatically from the IFS matrix — farmers within 20 km whose enterprise can use
        this.
      </p>

      {loading && <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />}
      {!loading && matches.length === 0 && (
        <EmptyState>No one nearby needs this resource right now.</EmptyState>
      )}
      {!loading && matches.length > 0 && (
        <ul className="space-y-2">
          {matches.map((m, i) => (
            <li
              key={`${m.their_farmer_id}-${i}`}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="text-sm">
                <span className="font-medium">
                  {enterpriseEmoji(m.their_enterprise)} {m.their_farmer_name}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  <ArrowRight className="inline w-3 h-3" /> {m.their_enterprise}
                </span>
                <div className="text-xs text-muted-foreground">
                  {m.their_village ? `${m.their_village} · ` : ''}
                  {formatDistance(m.distance_m)}
                </div>
              </div>
              <ConnectionRequestButton
                otherFarmerId={m.their_farmer_id}
                contextType="ifs_match"
                label="Offer it"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
