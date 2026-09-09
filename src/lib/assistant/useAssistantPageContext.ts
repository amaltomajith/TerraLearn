import { useEffect } from 'react';
import { useAssistant } from './AssistantProvider';
import type { AssistantExtraContext, CropContextData, ScanContextData } from './types';

/**
 * Publishes the current screen's context (pin, crop result, environment
 * snapshot, leaf-scan result) to the global assistant, and clears it on
 * unmount. Called by src/components/home.tsx and src/components/saath/ScanPage.tsx;
 * other screens simply don't call it.
 */
export function useAssistantPageContext(ctx: {
  position: { lat: number; lng: number } | null;
  cropContext?: CropContextData | null;
  assistantContext?: AssistantExtraContext | null;
  scanContext?: ScanContextData | null;
}) {
  const { setPageContext } = useAssistant();
  const { position, cropContext, assistantContext, scanContext } = ctx;

  useEffect(() => {
    setPageContext({ position, cropContext, assistantContext, scanContext });
    return () => setPageContext(null);
  }, [setPageContext, position, cropContext, assistantContext, scanContext]);
}
