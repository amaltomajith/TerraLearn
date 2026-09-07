// Fetch wrapper for the assistant backend (/api/ask). Robustness patterns
// (localhost/127 fallback, abort) mirror src/components/EnvironmentalOutlook.tsx
// and the old AskTerraLearn.

import type { AskPayload, AskResult } from './types';

function baseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';
}

export async function askAssistant(
  payload: AskPayload,
  signal?: AbortSignal,
): Promise<AskResult> {
  const body = JSON.stringify(payload);
  const primary = baseUrl();

  let res: Response;
  try {
    res = await fetch(`${primary}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    // Swap localhost <-> 127.0.0.1 once (dev-only convenience).
    const alt = primary.includes('127.0.0.1')
      ? primary.replace('127.0.0.1', 'localhost')
      : primary.includes('localhost')
        ? primary.replace('localhost', '127.0.0.1')
        : primary;
    if (alt === primary) throw err;
    res = await fetch(`${alt}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { answer?: string; action?: AskResult['action'] };
  return {
    answer: data.answer || 'No response generated.',
    action: data.action,
  };
}
