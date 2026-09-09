import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Mic, MicOff, Plus, Send, Sparkles, X } from 'lucide-react';
import { useAssistant } from '@/lib/assistant/AssistantProvider';
import { useIdentity } from '@/lib/identity/identity';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { AssistantMessageBubble } from './AssistantMessageBubble';

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { messages, status, send, newChat, hasThread, bootstrapped, pageContext } =
    useAssistant();
  const { activeFarmer } = useIdentity();
  const { t, currentLocale, currentLanguageInfo } = useTranslation();
  const { isListening, startListening, stopListening, hasRecognitionSupport } =
    useVoiceAssistant(currentLocale);

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
    if (isListening) stopListening();
    if (!text) setInput('');
    void send(value);
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((text) => {
        setInput(text);
      });
    }
  };

  const locationLabel =
    pageContext?.assistantContext?.locationName ?? activeFarmer?.village ?? undefined;
  const cropLabel = pageContext?.cropContext?.crop;
  const showSuggestions = bootstrapped && messages.length === 0 && status !== 'loading';
  const suggestions = t('ai_suggestions') || [];

  return (
    <div className="flex h-full flex-col bg-card">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 shrink-0">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground truncate">
              {t('ai_assistant_title')}
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {[locationLabel, cropLabel].filter(Boolean).join(' · ') ||
                t('ai_assistant_sub')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <LanguageSelector compact className="h-7 text-[11px] px-2" />

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
            <span className="font-semibold text-foreground">
              {t('ai_greeting_prefix')}{activeFarmer?.name ? `, ${activeFarmer.name.split(' ')[0]}` : ''}.
            </span>{' '}
            {t('ai_greeting_body')}
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
              {t('ai_thinking')}
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
      {showSuggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Voice active listening banner */}
      {isListening && (
        <div className="px-4 py-1.5 bg-primary/10 border-t border-primary/20 flex items-center justify-between text-xs text-primary font-medium animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>{t('ai_voice_listening')} ({currentLanguageInfo.name})</span>
          </div>
          <button
            type="button"
            onClick={stopListening}
            className="text-[11px] underline hover:no-underline font-semibold"
          >
            {t('ai_voice_stop')}
          </button>
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
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? t('ai_voice_listening') : t('ai_input_placeholder')}
            disabled={status === 'loading'}
            className="h-10 w-full rounded-xl border border-border/60 bg-background pl-3.5 pr-10 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />

          {hasRecognitionSupport && (
            <button
              type="button"
              onClick={toggleVoice}
              title={isListening ? t('ai_voice_stop') : `Voice input (${currentLanguageInfo.name})`}
              className={`absolute right-1.5 p-1.5 rounded-lg transition-all ${
                isListening
                  ? 'bg-destructive text-destructive-foreground animate-bounce'
                  : 'text-muted-foreground hover:text-primary hover:bg-muted/80'
              }`}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

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
