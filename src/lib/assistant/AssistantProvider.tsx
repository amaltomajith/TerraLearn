import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useIdentity } from '@/lib/identity/identity';
import { getSupabase, isSupabaseConfigured } from '@/lib/saath/client';
import { threadIdFor, sendMessage } from '@/lib/saath/queries';
import { askAssistant } from './api';
import { buildSaathSnapshot } from './saathSnapshot';
import {
  appendMessage,
  createThread,
  getLatestThread,
  getThreadMessages,
  updateMessageMeta,
} from './queries';
import type {
  AskPayload,
  AssistantMessage,
  AssistantMeta,
  AssistantPageContext,
  SaathSnapshot,
} from './types';

const OPEN_KEY = 'terralearn-assistant-open';
const HISTORY_TURNS = 10;
const TURN_CHAR_CAP = 1500;
const SNAPSHOT_TTL_MS = 30_000;

type Status = 'idle' | 'loading' | 'error';

interface AssistantContextValue {
  open: boolean;
  setOpen: (b: boolean) => void;
  messages: AssistantMessage[];
  status: Status;
  bootstrapped: boolean;
  hasThread: boolean;
  send: (text: string) => Promise<void>;
  newChat: () => void;
  confirmSend: (messageId: string, editedBody: string) => Promise<void>;
  dismissAction: (messageId: string) => void;
  /** Resolve a proposed recipient name against the current Saath snapshot (for the confirm card). */
  recipientHint: (name: string) => RecipientResolution;
  pageContext: AssistantPageContext | null;
  setPageContext: (ctx: AssistantPageContext | null) => void;
}

interface RecipientMatch {
  id: string;
  name: string;
  village?: string;
  distanceKm?: number;
  threadId?: string;
}

/**
 * `ambiguous` is deliberate: if the model's proposed name matches more than one
 * distinct Saath contact we do NOT silently pick one — the confirm card refuses
 * and tells the farmer to message from Saath directly. The whole point of the
 * confirm step is that the human knows exactly who a message goes to.
 */
type RecipientResolution =
  | { status: 'ok'; match: RecipientMatch }
  | { status: 'none' }
  | { status: 'ambiguous'; names: string[] };

/** Resolve a name the model proposed to a real farmer id from the Saath snapshot. */
function resolveRecipient(name: string, snap: SaathSnapshot | null): RecipientResolution {
  if (!snap) return { status: 'none' };
  const want = name.trim().toLowerCase();
  if (!want) return { status: 'none' };

  const cands: RecipientMatch[] = [
    ...snap.inbox.map((i) => ({ id: i.otherId, name: i.otherName, threadId: i.threadId })),
    ...snap.nearbyFarmers.map((f) => ({
      id: f.id,
      name: f.name,
      village: f.village,
      distanceKm: f.distanceKm,
    })),
    ...snap.ifsLoops.map((l) => ({
      id: l.theirId,
      name: l.theirName,
      distanceKm: l.distanceKm,
    })),
    ...snap.nearbyDemand.map((b) => ({
      id: b.buyerId,
      name: b.buyerName,
      distanceKm: b.distanceKm,
    })),
  ].filter((c) => c.id && c.name);

  const tiers: Array<(c: RecipientMatch) => boolean> = [
    (c) => c.name.toLowerCase() === want,
    (c) =>
      c.name.toLowerCase().startsWith(want) || want.startsWith(c.name.toLowerCase()),
    (c) => c.name.toLowerCase().includes(want),
  ];

  for (const test of tiers) {
    const hits = cands.filter(test);
    if (hits.length === 0) continue;
    // The same person can appear in several snapshot lists (same id) — that's
    // not ambiguity. Dedupe by id, keeping the first (closest / richest) hit.
    const byId = new Map<string, RecipientMatch>();
    for (const h of hits) if (!byId.has(h.id)) byId.set(h.id, h);
    const unique = [...byId.values()];
    if (unique.length === 1) return { status: 'ok', match: unique[0] };
    return { status: 'ambiguous', names: [...new Set(unique.map((m) => m.name))] };
  }
  return { status: 'none' };
}

const Ctx = createContext<AssistantContextValue | null>(null);

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

let tempSeq = 0;
function tempMessage(role: 'user' | 'assistant', content: string): AssistantMessage {
  return {
    id: `temp-${++tempSeq}`,
    thread_id: '',
    role,
    content,
    meta: null,
    created_at: new Date().toISOString(),
  };
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { activeFarmer, activeFarmerId, primaryFarm } = useIdentity();

  const [open, setOpenState] = useState(readOpen);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [bootstrapped, setBootstrapped] = useState(false);
  const [pageContext, setPageContextState] = useState<AssistantPageContext | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const snapshotRef = useRef<{ data: SaathSnapshot | null; at: number }>({
    data: null,
    at: 0,
  });

  const setOpen = useCallback((b: boolean) => {
    setOpenState(b);
    try {
      localStorage.setItem(OPEN_KEY, b ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const setPageContext = useCallback((ctx: AssistantPageContext | null) => {
    setPageContextState(ctx);
  }, []);

  const refreshSnapshot = useCallback(
    async (force = false) => {
      if (!activeFarmerId || !isSupabaseConfigured) return;
      if (!force && Date.now() - snapshotRef.current.at < SNAPSHOT_TTL_MS) return;
      try {
        snapshotRef.current = {
          data: await buildSaathSnapshot(activeFarmerId),
          at: Date.now(),
        };
      } catch {
        /* keep the previous snapshot */
      }
    },
    [activeFarmerId],
  );

  // Warm the Saath snapshot when the panel is opened.
  useEffect(() => {
    if (open) void refreshSnapshot();
  }, [open, refreshSnapshot]);

  // --- load the most recent thread once the farmer is known ----------------
  useEffect(() => {
    if (!activeFarmerId || !isSupabaseConfigured) {
      setBootstrapped(true);
      return;
    }
    let cancelled = false;
    setBootstrapped(false);
    (async () => {
      try {
        const t = await getLatestThread(activeFarmerId);
        if (cancelled) return;
        if (t) {
          setThreadId(t.id);
          setMessages(await getThreadMessages(t.id));
        }
      } catch {
        /* first run with no memory, or offline — start fresh */
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFarmerId]);

  // --- multi-tab sync of the open thread ----------------------------------
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !threadId) return;
    const channel = sb
      .channel(`assistant:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assistant_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const next = payload.new as AssistantMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === next.id) ? prev : [...prev, next],
          );
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [threadId]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setThreadId(null);
    setMessages([]);
    setStatus('idle');
  }, []);

  const patchMessageMeta = useCallback(
    (messageId: string, meta: AssistantMeta) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, meta } : m)),
      );
      void updateMessageMeta(messageId, meta).catch(() => {
        /* best effort — the local state already reflects the change */
      });
    },
    [],
  );

  const dismissAction = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.meta?.action) return;
      patchMessageMeta(messageId, { ...msg.meta, actionDismissed: true });
    },
    [messages, patchMessageMeta],
  );

  const recipientHint = useCallback(
    (name: string) => resolveRecipient(name, snapshotRef.current.data),
    [],
  );

  const confirmSend = useCallback(
    async (messageId: string, editedBody: string) => {
      const msg = messages.find((m) => m.id === messageId);
      const action = msg?.meta?.action;
      if (!msg || !action || msg.meta?.actionSentAt || !activeFarmerId) return;

      const body = editedBody.trim();
      if (!body) return;

      const resolution = resolveRecipient(action.recipientName, snapshotRef.current.data);
      if (resolution.status === 'ambiguous') {
        toast.error(
          `More than one contact matches "${action.recipientName}" — message them from Saath directly.`,
        );
        return;
      }
      if (resolution.status !== 'ok') {
        toast.error(`Couldn't find "${action.recipientName}" in your Saath network.`);
        return;
      }
      const to = resolution.match;

      try {
        const targetThread = to.threadId ?? (await threadIdFor(activeFarmerId, to.id));
        await sendMessage({
          thread_id: targetThread,
          sender_id: activeFarmerId,
          recipient_id: to.id,
          content: body,
        });

        const sentAt = new Date().toISOString();
        const resolvedAction = {
          ...action,
          body,
          recipientName: to.name,
          recipientFarmerId: to.id,
          threadId: targetThread,
        };
        patchMessageMeta(messageId, {
          ...(msg.meta ?? {}),
          action: resolvedAction,
          actionSentAt: sentAt,
        });

        if (threadId) {
          await appendMessage({
            threadId,
            role: 'system',
            content: `Sent to ${to.name}`,
            meta: { action: resolvedAction, actionSentAt: sentAt },
          });
        }
        toast.success(`Message sent to ${to.name}`);
      } catch (err) {
        console.error('confirmSend failed:', err);
        toast.error('Could not send the message. Please try again.');
      }
    },
    [messages, activeFarmerId, threadId, patchMessageMeta],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      // sendingRef is synchronous — guards against a double-submit landing
      // before the `status` state update re-renders.
      if (!text || sendingRef.current) return;
      if (!activeFarmerId) {
        toast.error('Finish setting up your profile to use the assistant.');
        return;
      }
      sendingRef.current = true;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const priorTurns = messages
        .filter((m) => m.role !== 'system')
        .slice(-HISTORY_TURNS)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content.slice(0, TURN_CHAR_CAP),
        }));

      setMessages((prev) => [...prev, tempMessage('user', text)]);
      setStatus('loading');

      try {
        let tid = threadId;
        if (!tid) {
          const t = await createThread(activeFarmerId, deriveTitle(text));
          tid = t.id;
          setThreadId(tid);
        }
        await appendMessage({ threadId: tid, role: 'user', content: text });

        await refreshSnapshot();

        const pc = pageContext;
        const extra = pc?.assistantContext ?? undefined;
        const payload: AskPayload = {
          question: text,
          lat: pc?.position?.lat ?? primaryFarm?.lat ?? null,
          lng: pc?.position?.lng ?? primaryFarm?.lng ?? null,
          cropContext: pc?.cropContext ?? null,
          history: priorTurns,
          farmerLanguage: activeFarmer?.language ?? null,
          farmerName: activeFarmer?.name ?? null,
          village: activeFarmer?.village ?? null,
          enterprises: activeFarmer?.enterprises ?? null,
          locationName: extra?.locationName,
          env: extra?.env,
          suggestedCrops: extra?.suggestedCrops,
          mandiTrendPct: extra?.mandiTrendPct,
          buyerDemand: extra?.buyerDemand,
          saath: snapshotRef.current.data ?? undefined,
        };

        const result = await askAssistant(payload, ac.signal);
        if (ac.signal.aborted) return;

        // The backend always returns HTTP 200; hard failures come back as an
        // error string in `answer`. Don't persist those as a real turn.
        if (/^error running environmental assistant/i.test(result.answer)) {
          throw new Error(result.answer);
        }

        await appendMessage({
          threadId: tid,
          role: 'assistant',
          content: result.answer,
          meta: result.action ? { action: result.action } : null,
        });

        setMessages(await getThreadMessages(tid));
        setStatus('idle');
      } catch (err) {
        if (ac.signal.aborted) return;
        console.error('assistant send failed:', err);
        setStatus('error');
        toast.error('Could not reach the assistant. Please try again.');
      } finally {
        sendingRef.current = false;
      }
    },
    [activeFarmerId, activeFarmer, primaryFarm, messages, threadId, pageContext, refreshSnapshot],
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      open,
      setOpen,
      messages,
      status,
      bootstrapped,
      hasThread: Boolean(threadId),
      send,
      newChat,
      confirmSend,
      dismissAction,
      recipientHint,
      pageContext,
      setPageContext,
    }),
    [
      open,
      setOpen,
      messages,
      status,
      bootstrapped,
      threadId,
      send,
      newChat,
      confirmSend,
      dismissAction,
      recipientHint,
      pageContext,
      setPageContext,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAssistant must be used within <AssistantProvider>');
  return v;
}
