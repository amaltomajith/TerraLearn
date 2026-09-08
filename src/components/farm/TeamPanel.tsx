import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Users,
  Plus,
  Copy,
  Link,
  Trash2,
  UserPlus,
  ShieldCheck,
  ClipboardList,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Navigation } from '@/components/Navigation';
import NavAuthControl from '@/components/saath/NavAuthControl';
import { useIdentity } from '@/lib/identity/identity';
import { useAsync } from '@/lib/saath/useAsync';
import {
  listFarmMembers,
  updateMemberRole,
  removeMember,
  createFarmInvite,
  listFarmInvites,
  revokeInvite,
  listFarmTasks,
  createFarmTask,
  updateFarmTask,
} from '@/lib/farm/queries';
import { useFarmSeason } from '@/lib/farm/useFarmSeason';
import type { FarmMemberRow, FarmInvite, FarmTask } from '@/lib/farm/types';
import type { FarmMemberRole } from '@/lib/saath/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const ROLE_LABEL: Record<FarmMemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  worker: 'Worker',
};

export default function TeamPanel() {
  const navigate = useNavigate();
  const { activeFarmerId, primaryFarm, farms } = useIdentity();

  // The farm to manage — default to primaryFarm
  const farm = primaryFarm;
  const farmId = farm?.id ?? null;
  const myRole = farm?.member_role ?? 'owner';

  // Redirect workers — they don't get this page
  useEffect(() => {
    if (myRole === 'worker') navigate('/', { replace: true });
  }, [myRole, navigate]);

  // --- data ---
  const { data: members, reload: reloadMembers } = useAsync(
    async () => (farmId ? listFarmMembers(farmId) : []),
    [farmId],
  );

  const { data: invites, reload: reloadInvites } = useAsync(
    async () => (farmId ? listFarmInvites(farmId) : []),
    [farmId],
  );

  const { data: tasks, reload: reloadTasks } = useAsync(
    async () => (farmId ? listFarmTasks(farmId) : []),
    [farmId],
  );

  const { activeCycle } = useFarmSeason(farmId);

  // --- invite ---
  const [invRole, setInvRole] = useState<'manager' | 'worker'>('worker');
  const [invBusy, setInvBusy] = useState(false);

  async function handleInvite() {
    if (!farmId || !activeFarmerId) return;
    setInvBusy(true);
    try {
      const inv = await createFarmInvite(farmId, invRole, activeFarmerId);
      await navigator.clipboard.writeText(inv.code);
      toast.success(`Invite code ${inv.code} copied!`);
      reloadInvites();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setInvBusy(false);
    }
  }

  async function handleRevoke(code: string) {
    try {
      await revokeInvite(code);
      toast.success('Invite revoked');
      reloadInvites();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // --- role change ---
  async function handleRoleChange(farmerId: string, role: FarmMemberRole) {
    if (!farmId) return;
    try {
      await updateMemberRole(farmId, farmerId, role);
      toast.success('Role updated');
      reloadMembers();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleRemoveMember(farmerId: string, name: string) {
    if (!farmId) return;
    if (!confirm(`Remove ${name} from this farm?`)) return;
    try {
      await removeMember(farmId, farmerId);
      toast.success(`${name} removed`);
      reloadMembers();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // --- new task ---
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);

  async function handleCreateTask() {
    if (!farmId || !activeFarmerId || !taskTitle.trim()) return;
    setTaskBusy(true);
    try {
      await createFarmTask({
        farmId,
        title: taskTitle.trim(),
        detail: taskDetail.trim() || null,
        assignedTo: taskAssignee || null,
        dueDate: taskDue || null,
        cycleId: activeCycle?.id ?? null,
        createdBy: activeFarmerId,
      });
      toast.success('Task created');
      setTaskOpen(false);
      setTaskTitle('');
      setTaskDetail('');
      setTaskAssignee('');
      setTaskDue('');
      reloadTasks();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTaskBusy(false);
    }
  }

  // --- task grouping by assignee ---
  const tasksByAssignee = useMemo(() => {
    const m: Record<string, FarmTask[]> = { unassigned: [] };
    for (const t of tasks ?? []) {
      const key = t.assigned_to ?? 'unassigned';
      (m[key] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  function memberName(id: string): string {
    return (members ?? []).find((m) => m.farmer_id === id)?.name ?? `…${id.slice(-4)}`;
  }

  async function toggleTaskDone(t: FarmTask) {
    try {
      await updateFarmTask(t.id, { status: t.status === 'done' ? 'open' : 'done' });
      reloadTasks();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!farm || myRole === 'worker') return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation authSlot={<NavAuthControl />} />

      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Team &amp; tasks</h1>
            <p className="text-xs text-muted-foreground">{farm.label}</p>
          </div>
        </div>

        {/* ── Members ────────────────────────────────────────── */}
        <section className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Team roster</h2>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
              {(members ?? []).length}
            </span>
          </div>

          <ul className="divide-y divide-border/30">
            {(members ?? []).map((m) => {
              const isOwner = m.member_role === 'owner';
              const isMe = m.farmer_id === activeFarmerId;
              return (
                <li key={m.farmer_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {m.name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {m.name}
                      {isMe && <span className="text-muted-foreground font-normal ml-1">(you)</span>}
                    </p>
                    {m.phone && <p className="text-[11px] text-muted-foreground">{m.phone}</p>}
                  </div>
                  {isOwner ? (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Owner
                    </span>
                  ) : myRole === 'owner' ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.member_role}
                        onChange={(e) => handleRoleChange(m.farmer_id, e.target.value as FarmMemberRole)}
                        className="text-xs rounded-lg border border-border/60 bg-background px-2 py-1"
                      >
                        <option value="manager">Manager</option>
                        <option value="worker">Worker</option>
                      </select>
                      {!isMe && (
                        <button
                          onClick={() => handleRemoveMember(m.farmer_id, m.name)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                      {ROLE_LABEL[m.member_role as FarmMemberRole]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Invites ────────────────────────────────────────── */}
        {myRole === 'owner' && (
          <section className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Invite to this farm</h2>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={invRole}
                onChange={(e) => setInvRole(e.target.value as 'manager' | 'worker')}
                className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <option value="worker">Worker</option>
                <option value="manager">Manager</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={invBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Generate code
              </button>
            </div>

            {(invites ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active invites</p>
                {(invites ?? []).map((inv) => (
                  <div
                    key={inv.code}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
                  >
                    <span className="font-mono text-sm font-bold text-foreground tracking-wider">{inv.code}</span>
                    <span className="text-[10px] text-muted-foreground">{inv.role}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {format(new Date(inv.created_at), 'd MMM')}
                    </span>
                    <button
                      onClick={async () => {
                        const link = `${window.location.origin}/sign-up?invite=${inv.code}`;
                        await navigator.clipboard.writeText(link);
                        toast.success('Sign-up link copied — share with the farmer!');
                      }}
                      className="text-muted-foreground hover:text-primary"
                      title="Copy sign-up link"
                    >
                      <Link className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(inv.code);
                        toast.success('Copied!');
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy code only"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRevoke(inv.code)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Revoke"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Task board ─────────────────────────────────────── */}
        <section className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Task board</h2>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full ml-auto">
              {(tasks ?? []).length} tasks
            </span>

            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="w-3 h-3" /> New task
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New task</DialogTitle>
                  <DialogDescription>Assign work to a team member.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
                  <input
                    placeholder="Task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Detail (optional)"
                    value={taskDetail}
                    onChange={(e) => setTaskDetail(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs text-muted-foreground">
                      Assign to
                      <select
                        value={taskAssignee}
                        onChange={(e) => setTaskAssignee(e.target.value)}
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
                        value={taskDue}
                        onChange={(e) => setTaskDue(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <button
                    onClick={() => setTaskOpen(false)}
                    className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTask}
                    disabled={taskBusy || !taskTitle.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {taskBusy ? 'Creating…' : 'Create task'}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tasks grouped by assignee */}
          {Object.entries(tasksByAssignee).map(([key, group]) => {
            if (group.length === 0) return null;
            const label = key === 'unassigned' ? 'Unassigned' : memberName(key);
            return (
              <div key={key}>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                <ul className="space-y-2">
                  {group.map((t) => (
                    <li
                      key={t.id}
                      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                        t.status === 'done'
                          ? 'border-border/20 bg-muted/10 opacity-60'
                          : 'border-border/40 bg-background'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(t)}
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {t.status === 'done' ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold leading-snug ${t.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {t.title}
                        </p>
                        {t.detail && <p className="text-xs text-foreground/70 mt-0.5">{t.detail}</p>}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          {t.due_date && <span>Due {format(new Date(t.due_date), 'd MMM')}</span>}
                          {t.source === 'advisory' && (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-semibold">
                              advisory
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {(tasks ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No tasks yet — create one above.</p>
          )}
        </section>
      </div>
    </div>
  );
}
