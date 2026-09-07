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
import { askAssistant } from './api';
import { buildSaathSnapshot } from './saathSnapshot';
import {
  appendMessage,
  createThread,
  getLatestThread,
  getThreadMessages,
} from './queries';
import type {
  AskPayload,
  AssistantMessage,
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
  pageContext: AssistantPageContext | null;
  setPageContext: (ctx: AssistantPageContext | null) => void;
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
      pageContext,
      setPageContext,
    }),
    [open, setOpen, messages, status, bootstrapped, threadId, send, newChat, pageContext, setPageContext],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAssistant must be used within <AssistantProvider>');
  return v;
}
