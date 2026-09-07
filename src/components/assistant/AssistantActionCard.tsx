import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Send, X } from 'lucide-react';
import { useAssistant } from '@/lib/assistant/AssistantProvider';
import type { AssistantMessage } from '@/lib/assistant/types';

/**
 * The draft-and-confirm card for a `send_message` proposal. Nothing is sent
 * until the farmer taps Send; the message then goes out via the normal
 * `sendMessage()` path as the signed-in user.
 */
export function AssistantActionCard({ message }: { message: AssistantMessage }) {
  const { confirmSend, dismissAction, recipientHint } = useAssistant();
  const action = message.meta?.action;
  const sentAt = message.meta?.actionSentAt;
  const [body, setBody] = useState(action?.body ?? '');
  const [busy, setBusy] = useState(false);

  if (!action) return null;

  const resolution = sentAt ? null : recipientHint(action.recipientName);
  const match = resolution?.status === 'ok' ? resolution.match : null;
  const canSend = resolution?.status === 'ok';
  const subtitle = match
    ? [match.village, match.distanceKm != null ? `${match.distanceKm} km` : null]
        .filter(Boolean)
        .join(' · ')
    : null;

  // Sent — collapsed confirmation.
  if (sentAt) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
        <span className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 shrink-0" />
          Sent to {action.recipientName}
          {action.threadId && (
            <>
              {' · '}
              <Link
                to={`/saath/messages/${action.threadId}`}
                className="underline underline-offset-2 hover:opacity-80"
              >
                View in Messages
              </Link>
            </>
          )}
        </span>
      </div>
    );
  }

  const onSend = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await confirmSend(message.id, body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Draft message to{' '}
        <span className="text-foreground">{match?.name ?? action.recipientName}</span>
      </p>
      {subtitle ? (
        <p className="mb-1.5 text-[11px] text-muted-foreground">{subtitle}</p>
      ) : resolution?.status === 'ambiguous' ? (
        <p className="mb-1.5 text-[11px] text-amber-600 dark:text-amber-500">
          More than one contact matches this name
          {resolution.names.length ? ` (${resolution.names.join(', ')})` : ''} — open Saath
          to message the right person.
        </p>
      ) : resolution?.status === 'none' ? (
        <p className="mb-1.5 text-[11px] text-amber-600 dark:text-amber-500">
          Not found in your Saath network — check the name before sending.
        </p>
      ) : (
        <div className="mb-1.5" />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        disabled={busy}
        className="w-full resize-none rounded-lg border border-border/60 bg-card px-2.5 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={busy || !body.trim() || !canSend}
          title={
            resolution?.status === 'ambiguous'
              ? 'More than one contact matches — message from Saath directly'
              : !canSend
                ? 'Recipient not found in your Saath network'
                : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => dismissAction(message.id)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
