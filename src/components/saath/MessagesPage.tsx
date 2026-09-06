import { useNavigate, useParams } from 'react-router-dom';
import { useSaathIdentity } from './SaathIdentityProvider';
import { useAsync } from '@/lib/saath/useAsync';
import { getInbox } from '@/lib/saath/queries';
import { SectionCard, EmptyState } from './primitives';
import { MessageThread } from './MessageThread';
import { cn } from '@/lib/utils';

export function MessagesPage() {
  const { activeFarmerId } = useSaathIdentity();
  const { threadId } = useParams();
  const navigate = useNavigate();

  const { data: inbox, loading } = useAsync(
    () => (activeFarmerId ? getInbox(activeFarmerId) : Promise.resolve([])),
    [activeFarmerId, threadId],
  );

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <SectionCard title="Conversations" className="h-fit">
        {loading && <div className="h-20 rounded-xl bg-muted/40 animate-pulse" />}
        {inbox && inbox.length === 0 && (
          <EmptyState>No conversations yet. Connect from the feed or map.</EmptyState>
        )}
        <ul className="space-y-1">
          {(inbox ?? []).map((m) => (
            <li key={m.thread_id}>
              <button
                onClick={() => navigate(`/saath/messages/${m.thread_id}`)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
                  threadId === m.thread_id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50',
                )}
              >
                <p className="truncate">{m.content}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard>
        {threadId ? (
          <MessageThread threadId={threadId} />
        ) : (
          <EmptyState>Select a conversation.</EmptyState>
        )}
      </SectionCard>
    </div>
  );
}
