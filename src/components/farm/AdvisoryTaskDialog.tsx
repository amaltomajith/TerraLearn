import { useState } from 'react';
import { toast } from 'sonner';
import { useIdentity } from '@/lib/identity/identity';
import { useAsync } from '@/lib/saath/useAsync';
import { createFarmTask, listFarmMembers } from '@/lib/farm/queries';
import type { Advisory } from '@/lib/advisories';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  advisory: Advisory | null;
  farmId: string;
  cycleId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export function AdvisoryTaskDialog({ advisory, farmId, cycleId, onClose, onCreated }: Props) {
  const { activeFarmerId } = useIdentity();
  const [taskBusy, setTaskBusy] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const { data: members } = useAsync(
    async () => listFarmMembers(farmId),
    [farmId],
  );

  async function handleCreateTask() {
    if (!advisory || !activeFarmerId) return;
    setTaskBusy(true);
    try {
      await createFarmTask({
        farmId,
        title: advisory.title,
        detail: advisory.detail,
        assignedTo: assignee || null,
        dueDate: dueDate || null,
        cycleId,
        source: 'advisory',
        createdBy: activeFarmerId,
      });
      toast.success('Task created from advisory');
      onCreated();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTaskBusy(false);
    }
  }

  return (
    <Dialog open={!!advisory} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Assign this advisory as a task.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p className="font-semibold text-foreground">{advisory?.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{advisory?.detail}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              Assign to
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {(members ?? []).map((m) => (
                  <option key={m.farmer_id} value={m.farmer_id}>
                    {m.name} ({m.member_role})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateTask}
            disabled={taskBusy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {taskBusy ? 'Creating…' : 'Create task'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
