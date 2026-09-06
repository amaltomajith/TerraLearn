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

/** Persistent, collapsible AskTerraLearn panel docked to the bottom-right of Home. */
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
    <div className="fixed bottom-4 right-4 z-[900] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(92vw,380px)] rounded-2xl overflow-hidden shadow-2xl border border-border/60 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <AskTerraLearn position={position} cropContext={cropContext} />
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 h-12 px-4 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:bg-primary/90 hover:shadow-xl active:scale-[0.97] transition-all"
      >
        {open ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        {open ? 'Hide assistant' : 'Ask TerraLearn'}
      </button>
    </div>
  );
}
