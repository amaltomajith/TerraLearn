import { motion } from 'framer-motion';
import { Bot, User, Volume2, VolumeX } from 'lucide-react';
import { Markdown } from '@/lib/assistant/renderMarkdown';
import type { AssistantMessage } from '@/lib/assistant/types';
import { AssistantActionCard } from './AssistantActionCard';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';

export function AssistantMessageBubble({ message }: { message: AssistantMessage }) {
  const { currentLocale, t } = useTranslation();
  const { speak, stopSpeaking, isSpeaking, hasSynthesisSupport } = useVoiceAssistant(currentLocale);

  // PR3 renders a "Sent to X" confirmation line from system rows.
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-muted-foreground bg-muted/40 rounded-full px-3 py-1">
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary">
          <Bot className="w-4 h-4" />
        </div>
      )}

      <div
        className={`relative group max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
            : 'bg-muted/50 dark:bg-muted/25 border border-border/40 text-foreground rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div>
            <Markdown>{message.content}</Markdown>
            {hasSynthesisSupport && message.content && (
              <div className="mt-2 pt-1.5 border-t border-border/30 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => (isSpeaking ? stopSpeaking() : speak(message.content))}
                  title={isSpeaking ? t('ai_voice_stop') : t('ai_voice_speak')}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors ${
                    isSpeaking
                      ? 'bg-primary/20 text-primary font-medium animate-pulse'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>{t('ai_voice_stop')}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{t('ai_voice_speak')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {!isUser && message.meta?.action && !message.meta.actionDismissed && (
          <AssistantActionCard message={message} />
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5 text-accent-foreground">
          <User className="w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
}
