import { ArrowRight, Repeat } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getIfsLoops } from '@/lib/saath/queries';
import { enterpriseEmoji, enterpriseLabel } from '@/lib/saath/ifsMatrix';
import { formatDistance } from '@/lib/saath/distance';
import { SectionCard, EmptyState } from './primitives';
import { ConnectionRequestButton } from './ConnectionRequestButton';

export function CircularLoopsPanel() {
  const { activeFarmer, activeFarmerId } = useSaathIdentity();
  const { data, loading, error } = useAsync(
    () => (activeFarmerId ? getIfsLoops(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId],
  );

  const hasEnterprises = (activeFarmer?.enterprises?.length ?? 0) > 0;

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
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}
      {hasEnterprises && data && data.length === 0 && (
        <EmptyState>No circular matches within 20 km yet.</EmptyState>
      )}
      {hasEnterprises && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((m, i) => (
            <li
              key={`${m.their_farmer_id}-${m.resource}-${i}`}
              className="rounded-xl border border-border/60 p-3"
            >
              <div className="flex items-center gap-2 text-sm">
                {m.direction === 'i_supply' ? (
                  <>
                    <span className="font-medium">
                      {enterpriseEmoji(m.my_enterprise)} your {enterpriseLabel(m.my_enterprise)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent" />
                    <span className="font-mono text-xs bg-accent/10 text-accent rounded px-1.5 py-0.5">
                      {m.resource}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent" />
                    <span className="font-medium">
                      {enterpriseEmoji(m.their_enterprise)} {m.their_farmer_name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">
                      {enterpriseEmoji(m.their_enterprise)} {m.their_farmer_name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent" />
                    <span className="font-mono text-xs bg-accent/10 text-accent rounded px-1.5 py-0.5">
                      {m.resource}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent" />
                    <span className="font-medium">
                      your {enterpriseLabel(m.my_enterprise)}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {m.their_village ? `${m.their_village} · ` : ''}
                  {formatDistance(m.distance_m)}
                  {m.has_active_listing ? ' · has an active listing' : ''}
                </span>
                <ConnectionRequestButton
                  otherFarmerId={m.their_farmer_id}
                  contextType="ifs_match"
                  label="Reach out"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
