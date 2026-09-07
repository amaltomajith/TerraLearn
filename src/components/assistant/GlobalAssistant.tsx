import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useAssistant } from '@/lib/assistant/AssistantProvider';
import { useIdentity } from '@/lib/identity/identity';
import { isSupabaseConfigured } from '@/lib/saath/client';
import { AssistantPanel } from './AssistantPanel';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

/**
 * The app-wide AI assistant: a floating button on every authenticated page that
 * opens a chat surface. Mounted once in RootGate, above <Routes>, so the
 * conversation survives navigation. Desktop = anchored floating panel (never in
 * document flow); mobile = bottom sheet.
 */
export function GlobalAssistant() {
  const { activeFarmerId } = useIdentity();
  const { open, setOpen, status } = useAssistant();
  const isDesktop = useIsDesktop();
  const [hovered, setHovered] = useState(false);

  // Not ready for an anonymous / un-onboarded user, or without Supabase.
  if (!activeFarmerId || !isSupabaseConfigured) return null;

  const showLabel = hovered && !open;

  return (
    <>
      {/* panel */}
      <AnimatePresence>
        {open && (
          <>
            {!isDesktop && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[899] bg-black/40"
              />
            )}
            <motion.div
              key="panel"
              initial={isDesktop ? { opacity: 0, y: 16, scale: 0.98 } : { y: '100%' }}
              animate={isDesktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={isDesktop ? { opacity: 0, y: 16, scale: 0.98 } : { y: '100%' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={
                isDesktop
                  ? 'fixed bottom-20 right-4 z-[900] w-[380px] h-[min(560px,calc(100vh-7rem))] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl'
                  : 'fixed inset-x-0 bottom-0 z-[900] h-[85vh] overflow-hidden rounded-t-2xl border-t border-border/60 bg-card shadow-2xl'
              }
            >
              <AssistantPanel onClose={() => setOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* floating button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed bottom-4 right-4 z-[901] inline-flex h-12 items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.97]"
        aria-label={open ? 'Hide assistant' : 'Ask TerraLearn AI'}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {open ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {!open && status === 'loading' && (
            <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-primary-foreground" />
          )}
        </span>
        <AnimatePresence initial={false}>
          {(showLabel || open) && (
            <motion.span
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="overflow-hidden whitespace-nowrap"
            >
              {open ? 'Hide assistant' : 'Ask TerraLearn'}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}
