import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Plus, Send, Sparkles, X } from 'lucide-react';
import { useAssistant } from '@/lib/assistant/AssistantProvider';
import { useIdentity } from '@/lib/identity/identity';
import { AssistantMessageBubble } from './AssistantMessageBubble';

const SUGGESTED = [
  'How is the weather looking for my farm this week?',
  'What can I do about low soil nitrogen?',
  'Which crop suits my land right now?',
  'Is the air quality safe for spraying today?',
];

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { messages, status, send, newChat, hasThread, bootstrapped, pageContext } =
    useAssistant();
  const { activeFarmer } = useIdentity();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the message list itself — never scrollIntoView, which would also
    // move the underlying page.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const submit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;
    if (!text) setInput('');
    void send(value);
  };

  const locationLabel =
    pageContext?.assistantContext?.locationName ?? activeFarmer?.village ?? undefined;
  const cropLabel = pageContext?.cropContext?.crop;
  const showSuggestions = bootstrapped && messages.length === 0 && status !== 'loading';

  return (
    <div className="flex h-full flex-col bg-card">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              TerraLearn AI
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {[locationLabel, cropLabel].filter(Boolean).join(' · ') ||
                'Your farm assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasThread && (
            <button
              type="button"
              onClick={newChat}
              title="New chat"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain scrollbar-thin px-4 py-4"
      >
        {messages.length === 0 && bootstrapped && (
          <div className="mt-2 rounded-xl bg-muted/40 p-3.5 text-sm text-muted-foreground">
            Namaskara{activeFarmer?.name ? `, ${activeFarmer.name.split(' ')[0]}` : ''}. Ask me
            about your weather, soil, crops, air quality, or the mandi — in plain words.
          </div>
        )}

        {messages.map((m) => (
          <AssistantMessageBubble key={m.id} message={m} />
        ))}

        {status === 'loading' && (
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <span className="rounded-2xl border border-border/40 bg-muted/40 px-3.5 py-2">
              Thinking…
            </span>
          </div>
        )}

        {status === 'error' && (
          <p className="text-center text-[11px] text-destructive">
            Something went wrong. Try asking again.
          </p>
        )}
      </div>

      {/* suggestions */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2 border-t border-border/50 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your farm…"
          disabled={status === 'loading'}
          className="h-10 flex-1 rounded-xl border border-border/60 bg-background px-3.5 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || status === 'loading'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
