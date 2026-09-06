import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useRealtimeThread } from '@/lib/saath/useRealtimeThread';
import { useAsync } from '@/lib/saath/useAsync';
import { getFarmer, sendMessage } from '@/lib/saath/queries';
import { cn } from '@/lib/utils';
import { ExchangePanel } from './ExchangePanel';

export function MessageThread({ threadId }: { threadId: string }) {
  const { activeFarmerId } = useSaathIdentity();
  const { messages } = useRealtimeThread(threadId);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const otherId =
    messages.find((m) => m.sender_id !== activeFarmerId)?.sender_id ??
    messages.find((m) => m.recipient_id !== activeFarmerId)?.recipient_id ??
    null;

  const { data: other } = useAsync(
    () => (otherId ? getFarmer(otherId) : Promise.resolve(null)),
    [otherId],
  );

  const lastListingId = messages.find((m) => m.context_type === 'listing')?.context_id ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || !activeFarmerId || !otherId) return;
    setBusy(true);
    try {
      await sendMessage({
        thread_id: threadId,
        sender_id: activeFarmerId,
        recipient_id: otherId,
        content: draft.trim(),
      });
      setDraft('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      <div className="border-b border-border/60 pb-2 mb-2">
        <p className="font-semibold text-foreground">{other?.name ?? 'Conversation'}</p>
        {other?.village && (
          <p className="text-xs text-muted-foreground">{other.village}</p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-1">
        {messages.map((m) => {
          const mine = m.sender_id === activeFarmerId;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                  mine
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm',
                )}
              >
                {m.content}
              </div>
            </div>
          );
        })}
      </div>

      {otherId && (
        <div className="my-3">
          <ExchangePanel
            otherId={otherId}
            otherName={other?.name ?? 'them'}
            otherIsBuyer={other?.role === 'buyer' || other?.role === 'both'}
            listingId={lastListingId}
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
        <input
          className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-primary w-9 h-9 flex items-center justify-center text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
