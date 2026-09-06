import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AskTerraLearn } from './AskTerraLearn';

interface CropContextData {
  crop: string;
  plantingDate: string;
  yieldEstimate: number;
  viabilityScore: number;
  profit: number;
}

const KEY = 'terralearn-assistant-open';

/**
 * Persistent, collapsible AskTerraLearn panel. The pill stays anchored
 * bottom-right; the expanded panel opens on the LEFT so it never covers the
 * simulator results column on wide screens.
 */
export function DockedAssistant({
  position,
  cropContext,
}: {
  position: { lat: number; lng: number } | null;
  cropContext?: CropContextData | null;
}) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <>
      {open && (
        <div
          className="fixed z-[900] left-4 right-4 bottom-[4.75rem] sm:left-6 sm:right-auto sm:bottom-4 sm:w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-2xl border border-border/60 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <AskTerraLearn position={position} cropContext={cropContext} />
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-4 right-4 z-[901] inline-flex items-center gap-2 h-12 px-4 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:bg-primary/90 hover:shadow-xl active:scale-[0.97] transition-all"
      >
        {open ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        {open ? 'Hide assistant' : 'Ask TerraLearn'}
      </button>
    </>
  );
}
