import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Sprout } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DateSelector } from '@/components/DateSelector';
import { CROP_DATABASE } from '@/lib/api';
import { useIdentity } from '@/lib/identity/identity';
import { createCropCycle } from '@/lib/farm/queries';
import type { Farm } from '@/lib/saath/types';

const ALL_CROPS = Object.values(CROP_DATABASE)
  .map((c) => c.name)
  .sort();

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Props {
  farm: Farm;
  onCreated: () => void;
  /** Custom trigger; defaults to a primary "Start this season" button. */
  trigger?: React.ReactNode;
}

export function AddCycleDialog({ farm, onCreated, trigger }: Props) {
  const { activeFarmerId } = useIdentity();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const cropChoices = useMemo(() => {
    const own = (farm.crops ?? []).filter(Boolean);
    return own.length ? own : ALL_CROPS;
  }, [farm.crops]);

  const [crop, setCrop] = useState(cropChoices[0] ?? '');
  const [sowingDate, setSowingDate] = useState<Date | undefined>(new Date());
  const [area, setArea] = useState<number>(farm.crops?.length ? 1 : 1);
  const [unit, setUnit] = useState<'hectares' | 'acres'>('hectares');

  async function submit() {
    if (!activeFarmerId) return;
    if (!crop) return toast.error('Pick a crop.');
    if (!sowingDate) return toast.error('Pick a sowing date.');
    const hectares = unit === 'acres' ? area * 0.404686 : area;
    if (!(hectares > 0)) return toast.error('Enter a valid area.');

    setBusy(true);
    try {
      await createCropCycle({
        farmId: farm.id,
        crop,
        sowingDate: isoDate(sowingDate),
        areaHectares: Math.round(hectares * 1000) / 1000,
        createdBy: activeFarmerId,
        status: 'active',
      });
      toast.success(`${crop} season started`);
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(`Could not start the season: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Sprout className="w-4 h-4" />
            Start this season
          </button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a crop season</DialogTitle>
          <DialogDescription>
            The dashboard tracks this from sowing to harvest — calendar, advisories and a
            yield projection, without asking again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <label className="block text-sm">
            <span className="text-muted-foreground">Crop</span>
            <select
              className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            >
              {cropChoices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-sm text-muted-foreground">Sowing / transplanting date</span>
            <div className="mt-1">
              <DateSelector date={sowingDate} onDateChange={setSowingDate} />
            </div>
          </div>

          <div>
            <span className="text-sm text-muted-foreground">Area planted</span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={area}
                onChange={(e) => setArea(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="flex-1 h-10 rounded-lg border border-border/60 bg-background px-3 text-sm font-mono"
              />
              <div className="flex rounded-lg border border-border/60 overflow-hidden">
                {(['hectares', 'acres'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-3 text-sm font-semibold transition-colors ${
                      unit === u
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    {u === 'hectares' ? 'ha' : 'ac'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Start season'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
