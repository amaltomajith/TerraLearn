import { ArrowRight, Repeat } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getIfsLoops } from '@/lib/saath/queries';
import {
  enterpriseEmoji,
  mergeIfsMatches,
  type MergedIfsLoopLeg,
} from '@/lib/saath/ifsMatrix';
import { formatDistance } from '@/lib/saath/distance';
import { SectionCard, EmptyState } from './primitives';
import { ConnectionRequestButton } from './ConnectionRequestButton';

function ResourceChips({ legs }: { legs: MergedIfsLoopLeg[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {legs.map((l) => (
        <span
          key={l.resource}
          className="font-mono text-xs bg-accent/10 text-accent rounded px-1.5 py-0.5"
        >
          {l.resource}
        </span>
      ))}
    </span>
  );
}

export function CircularLoopsPanel() {
  const { activeFarmer, activeFarmerId } = useSaathIdentity();
  const { data, loading, error } = useAsync(
    () => (activeFarmerId ? getIfsLoops(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId],
  );

  const hasEnterprises = (activeFarmer?.enterprises?.length ?? 0) > 0;
  const loops = data ? mergeIfsMatches(data) : [];

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-accent" />
          Circular loops on your farm
        </span>
      }
    >
      {!hasEnterprises && (
        <EmptyState>
          Add enterprises to your profile to see circular-agriculture matches.
        </EmptyState>
      )}
      {hasEnterprises && error && <p className="text-sm text-destructive">{error}</p>}
      {hasEnterprises && loading && !data && (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}
      {hasEnterprises && data && loops.length === 0 && (
        <EmptyState>No circular matches within 20 km yet.</EmptyState>
      )}
      {hasEnterprises && loops.length > 0 && (
        <ul className="space-y-1.5">
          {loops.map((loop) => {
            const enterpriseKey =
              loop.supply[0]?.their_enterprise ?? loop.need[0]?.their_enterprise ?? '';
            return (
              <li
                key={loop.their_farmer_id}
                className="rounded-xl border border-border/60 p-2.5"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{enterpriseEmoji(enterpriseKey)}</span>
                  <span>{loop.their_farmer_name}</span>
                </div>

                <div className="mt-1.5 space-y-1 text-sm">
                  {loop.supply.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                        You send
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      <ResourceChips legs={loop.supply} />
                    </div>
                  )}
                  {loop.need.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                        You receive
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5 rotate-180" />
                      <ResourceChips legs={loop.need} />
                    </div>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {loop.their_village ? `${loop.their_village} · ` : ''}
                    {formatDistance(loop.distance_m)}
                    {loop.has_active_listing ? ' · has an active listing' : ''}
                  </span>
                  <ConnectionRequestButton
                    otherFarmerId={loop.their_farmer_id}
                    contextType="ifs_match"
                    label="Reach out"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
