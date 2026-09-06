import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquarePlus } from 'lucide-react';
import { useSaathIdentity } from './SaathIdentityProvider';
import { threadIdFor, sendMessage } from '@/lib/saath/queries';

export function ConnectionRequestButton({
  otherFarmerId,
  listingId,
  listingTitle,
  contextType = 'listing',
  label = 'Connect',
}: {
  otherFarmerId: string;
  listingId?: string;
  listingTitle?: string;
  contextType?: 'listing' | 'offer' | 'ifs_match';
  label?: string;
}) {
  const { activeFarmerId } = useSaathIdentity();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (!activeFarmerId || activeFarmerId === otherFarmerId) return;
    setBusy(true);
    try {
      const threadId = await threadIdFor(activeFarmerId, otherFarmerId);
      await sendMessage({
        thread_id: threadId,
        sender_id: activeFarmerId,
        recipient_id: otherFarmerId,
        content: listingTitle
          ? `Hi — I'm interested in "${listingTitle}". Is it still available?`
          : 'Hi — I would like to connect about a possible exchange.',
        context_type: contextType,
        context_id: listingId ?? null,
      });
      navigate(`/saath/messages/${threadId}`);
    } catch (e) {
      toast.error(`Could not start the conversation: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={connect}
      disabled={busy || !activeFarmerId || activeFarmerId === otherFarmerId}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-8 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      <MessageSquarePlus className="w-3.5 h-3.5" />
      {busy ? 'Connecting…' : label}
    </button>
  );
}
