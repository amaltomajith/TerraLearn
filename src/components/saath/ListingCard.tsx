import { Link } from 'react-router-dom';
import { MapPin, Package, Tractor, Users, ShoppingCart } from 'lucide-react';
import type { NearbyListingRow } from '@/lib/saath/types';
import { formatDistance } from '@/lib/saath/distance';
import { ConnectionRequestButton } from './ConnectionRequestButton';
import { useSaathIdentity } from './SaathIdentityProvider';

const TYPE_ICON = {
  resource: Package,
  equipment: Tractor,
  labour: Users,
  demand: ShoppingCart,
} as const;

export function ListingCard({ row }: { row: NearbyListingRow }) {
  const { activeFarmerId } = useSaathIdentity();
  const Icon = TYPE_ICON[row.type] ?? Package;
  const isOwn = row.farmer_id === activeFarmerId;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{row.title}</p>
            <p className="text-xs text-muted-foreground">
              <Link to={`/saath/profile/${row.farmer_id}`} className="hover:text-primary">
                {row.farmer_name}
              </Link>
              {row.village ? ` · ${row.village}` : ''}
              {row.distance_m != null && (
                <>
                  {' · '}
                  <MapPin className="inline w-3 h-3 -mt-0.5" /> {formatDistance(row.distance_m)}
                </>
              )}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          {row.type}
        </span>
      </div>

      {row.description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{row.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {row.quantity != null && (
            <span className="font-mono">
              {row.quantity}
              {row.unit ? ` ${row.unit}` : ''}
            </span>
          )}
          {row.rate != null && (
            <span className="font-mono ml-2">
              ₹{row.rate}
              {row.unit ? `/${row.unit}` : ''}
            </span>
          )}
        </div>
        {!isOwn && (
          <ConnectionRequestButton
            otherFarmerId={row.farmer_id}
            listingId={row.id}
            listingTitle={row.title}
            label={row.type === 'demand' ? 'Respond' : 'Connect'}
          />
        )}
      </div>
    </div>
  );
}
