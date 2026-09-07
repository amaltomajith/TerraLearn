import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { Markdown } from '@/lib/assistant/renderMarkdown';
import type { AssistantMessage } from '@/lib/assistant/types';

export function AssistantMessageBubble({ message }: { message: AssistantMessage }) {
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
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
            : 'bg-muted/50 dark:bg-muted/25 border border-border/40 text-foreground rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown>{message.content}</Markdown>
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
