import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPinned, Pencil, Plus } from 'lucide-react';
import { useIdentity } from '@/lib/identity/identity';
import { setPrimaryFarm } from '@/lib/saath/queries';

interface Props {
  /** Called when the user switches farms — move the dashboard view here. */
  onPick: (lat: number, lng: number) => void;
  /** Called after farms change so the parent can refetch neighbours etc. */
  onFarmsChanged?: () => void;
}

export function FarmSwitcher({ onPick, onFarmsChanged }: Props) {
  const navigate = useNavigate();
  const { farms, primaryFarm, refresh } = useIdentity();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // default selection follows the primary farm until the user picks one
  useEffect(() => {
    if (!selectedId && primaryFarm) {
      setSelectedId(primaryFarm.id);
    }
  }, [primaryFarm, selectedId]);

  if (farms.length === 0) return null;

  const selected = farms.find((f) => f.id === selectedId) ?? primaryFarm;

  function pick(id: string) {
    const f = farms.find((x) => x.id === id);
    if (!f) return;
    setSelectedId(id);
    onPick(f.lat, f.lng);
  }

  async function makePrimary() {
    if (!selected || selected.is_primary) return;
    setBusy(true);
    try {
      await setPrimaryFarm(selected.id);
      await refresh();
      onFarmsChanged?.();
      toast.success(`${selected.label} is now your primary farm`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <MapPinned className="w-4 h-4 text-primary shrink-0" />
        <select
          className="flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-sm"
          value={selected?.id ?? ''}
          onChange={(e) => pick(e.target.value)}
        >
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
              {f.is_primary ? ' (primary)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => navigate('/add-farm')}
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
        >
          <Plus className="w-3 h-3" /> Add farm
        </button>
        {selected && (
          <button
            onClick={() => navigate(`/add-farm/${selected.id}`)}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
        {selected && !selected.is_primary && (
          <button
            onClick={makePrimary}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            Set as primary
          </button>
        )}
      </div>
    </div>
  );
}
