// Fetch wrapper for the dev-only /debug/mcp-trace endpoint — mirrors
// src/lib/assistant/api.ts's askAssistant() shape (base URL resolution,
// localhost/127 fallback) since it hits the same backend.

export interface McpTraceStep {
  kind: 'tool_call' | 'tool_result';
  tool: string | null;
  args?: Record<string, unknown>;
  content?: string;
}

export interface McpTraceResult {
  error: string | null;
  steps: McpTraceStep[];
  answer: string | null;
  tool_count: number;
  tool_names?: string[];
}

export interface McpTracePayload {
  question: string;
  role: 'farmer' | 'buyer' | 'both';
  farmerId: string;
  language?: string;
}

function baseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';
}

export async function runMcpTrace(payload: McpTracePayload, signal?: AbortSignal): Promise<McpTraceResult> {
  const body = JSON.stringify(payload);
  const primary = baseUrl();

  let res: Response;
  try {
    res = await fetch(`${primary}/debug/mcp-trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const alt = primary.includes('127.0.0.1')
      ? primary.replace('127.0.0.1', 'localhost')
      : primary.includes('localhost')
        ? primary.replace('localhost', '127.0.0.1')
        : primary;
    if (alt === primary) throw err;
    res = await fetch(`${alt}/debug/mcp-trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as McpTraceResult;
}

export interface SamplePersona {
  id: string;
  name: string;
  role: string;
  village: string | null;
}
