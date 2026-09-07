import { useEffect } from 'react';
import { useAssistant } from './AssistantProvider';
import type { AssistantExtraContext, CropContextData } from './types';

/**
 * Publishes the current screen's context (pin, crop result, environment
 * snapshot) to the global assistant, and clears it on unmount. Called by
 * src/components/home.tsx; other screens simply don't call it.
 */
export function useAssistantPageContext(ctx: {
  position: { lat: number; lng: number } | null;
  cropContext?: CropContextData | null;
  assistantContext?: AssistantExtraContext | null;
}) {
  const { setPageContext } = useAssistant();
  const { position, cropContext, assistantContext } = ctx;

  useEffect(() => {
    setPageContext({ position, cropContext, assistantContext });
    return () => setPageContext(null);
  }, [setPageContext, position, cropContext, assistantContext]);
}
