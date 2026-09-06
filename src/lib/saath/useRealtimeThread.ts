import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from './client';
import { getThreadMessages } from './queries';
import type { Message } from './types';

/** Live message list for a thread. Falls back to a one-shot load if Realtime is off. */
export function useRealtimeThread(threadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      setMessages(await getThreadMessages(threadId));
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !threadId) return;

    const channel = sb
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((prev) => {
            const next = payload.new as Message;
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [threadId]);

  return { messages, loading, reload };
}
