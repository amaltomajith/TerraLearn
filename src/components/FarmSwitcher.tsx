import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPinned, Plus, Save } from 'lucide-react';
import { useIdentity } from '@/lib/identity/identity';
import { addFarm, updateFarmLocation, setPrimaryFarm } from '@/lib/saath/queries';
import { cn } from '@/lib/utils';

interface Props {
  /** The pin currently shown on the map. */
  pin: { lat: number; lng: number } | null;
  /** Called when the user switches farms — move the simulator pin here. */
  onPick: (lat: number, lng: number) => void;
  /** Called after farms change so the parent can refetch neighbours etc. */
  onFarmsChanged?: () => void;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;

export function FarmSwitcher({ pin, onPick, onFarmsChanged }: Props) {
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
  const pinMoved =
    selected && pin && !(near(pin.lat, selected.lat) && near(pin.lng, selected.lng));

  function pick(id: string) {
    const f = farms.find((x) => x.id === id);
    if (!f) return;
    setSelectedId(id);
    onPick(f.lat, f.lng);
  }

  async function saveLocation() {
    if (!selected || !pin) return;
    if (!window.confirm(`Move "${selected.label}" to the current pin? This updates your saved farm.`))
      return;
    setBusy(true);
    try {
      await updateFarmLocation(selected.id, pin.lat, pin.lng);
      await refresh();
      onFarmsChanged?.();
      toast.success(`Updated ${selected.label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAsNew() {
    if (!pin) return;
    const label = window.prompt('Name this farm', 'New plot')?.trim();
    if (!label) return;
    setBusy(true);
    try {
      const f = await addFarm({ label, lat: pin.lat, lng: pin.lng });
      await refresh();
      onFarmsChanged?.();
      setSelectedId(f.id);
      toast.success(`Added ${label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
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
          onClick={saveLocation}
          disabled={busy || !pinMoved}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium',
            pinMoved
              ? 'border-primary/40 text-primary hover:bg-primary/10'
              : 'border-border/50 text-muted-foreground',
          )}
        >
          <Save className="w-3 h-3" /> Update this farm's location
        </button>
        <button
          onClick={saveAsNew}
          disabled={busy || !pin}
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
        >
          <Plus className="w-3 h-3" /> Save pin as a new farm
        </button>
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
      {pinMoved && (
        <p className="text-[11px] text-muted-foreground">
          The pin is off your saved farm — simulate freely, or save it above.
        </p>
      )}
    </div>
  );
}
