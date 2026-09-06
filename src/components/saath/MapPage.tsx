import { useNavigate } from 'react-router-dom';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getMapPoints } from '@/lib/saath/queries';
import { MapView } from '@/components/MapView';
import { SectionCard } from './primitives';

const MANDYA: [number, number] = [12.5223, 76.8954];

export function MapPage() {
  const { activeFarmerId } = useSaathIdentity();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => getMapPoints(activeFarmerId),
    [activeFarmerId],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Farmers & buyers near Mandya">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading && !data && (
          <div className="h-[520px] rounded-2xl bg-muted/40 animate-pulse" />
        )}
        {data && (
          <MapView
            neighbours={data}
            onNeighbourClick={(id) => navigate(`/saath/profile/${id}`)}
            fit="neighbours"
            initialView={{ center: MANDYA, zoom: 11 }}
            heightClass="h-[520px]"
          />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Farmer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Buyer
          </span>
          <span>Distance is measured from your primary farm.</span>
        </div>
      </SectionCard>
    </div>
  );
}
