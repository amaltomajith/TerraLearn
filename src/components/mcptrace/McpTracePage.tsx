import { useEffect, useState } from 'react';
import { requireSupabase, isSupabaseConfigured } from '@/lib/saath/client';
import { runMcpTrace, type McpTraceResult, type SamplePersona } from '@/lib/mcptrace/api';
import { cn } from '@/lib/utils';

/**
 * Dev-only page: type a question, pick a role + a real farmer/buyer id, and
 * see the actual MCP tool-call trace the agent produced — not just its final
 * answer. Built to verify the Farmer/Buyer MCP servers' "thinking" is
 * correct (right tool, right arguments, right data), the same way the
 * Cascade page visualizes the FarmRisk engine's reasoning. Not linked from
 * the main farmer-facing nav — reach it directly at /mcp-trace.
 */

const SAMPLE_QUESTIONS = [
  "What's my farm situation right now?",
  'Should I sell my crop now, or wait?',
  'Is anyone nearby who could use what I produce?',
  'Draft a 300kg grade A lot for me — do not create it yet.',
  'Find lots near me and check if this GSTIN is valid: 27AAPFU0939F1ZV',
];

export default function McpTracePage() {
  const [personas, setPersonas] = useState<SamplePersona[]>([]);
  const [role, setRole] = useState<'farmer' | 'buyer' | 'both'>('farmer');
  const [farmerId, setFarmerId] = useState('');
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<McpTraceResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        const sb = requireSupabase();
        const { data, error } = await sb
          .from('farmers')
          .select('id,name,role,village')
          .order('name')
          .limit(30);
        if (error) throw error;
        setPersonas((data ?? []) as SamplePersona[]);
      } catch {
        // Non-fatal — the id field still accepts a pasted UUID.
      }
    })();
  }, []);

  async function run() {
    if (!question.trim() || !farmerId.trim()) return;
    setLoading(true);
    setFetchError(null);
    setResult(null);
    try {
      const r = await runMcpTrace({ question: question.trim(), role, farmerId: farmerId.trim(), language: 'en' });
      setResult(r);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">MCP reasoning trace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dev tool — see exactly which Farmer/Buyer MCP tools the assistant chose, with what
          arguments, and what came back. Not shown to farmers.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="farmer">farmer</option>
              <option value="buyer">buyer</option>
              <option value="both">both</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Farmer / buyer id</label>
            <input
              list="mcp-trace-personas"
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              placeholder="paste a farmers.id UUID, or pick below"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
            />
            <datalist id="mcp-trace-personas">
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role}{p.village ? `, ${p.village}` : ''})
                </option>
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="text-xs rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || !question.trim() || !farmerId.trim()}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Request failed: {fetchError}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Agent error: {result.error}
            </div>
          )}

          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {result.tool_count} tools loaded for role &quot;{role}&quot;
              {result.tool_names ? `: ${result.tool_names.join(', ')}` : ''}
            </div>
          </div>

          {result.steps.length === 0 && !result.error && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
              The model answered directly, with no tool call — worth checking whether it should
              have called one for this question.
            </div>
          )}

          <ol className="space-y-2">
            {result.steps.map((step, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-lg border p-3 text-sm font-mono',
                  step.kind === 'tool_call'
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border/50 bg-muted/30',
                )}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {step.kind === 'tool_call' ? 'agent calls' : 'tool result'}
                </div>
                {step.kind === 'tool_call' ? (
                  <div>
                    {step.tool}({JSON.stringify(step.args)})
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-all">
                    [{step.tool}] {step.content}
                  </div>
                )}
              </li>
            ))}
          </ol>

          {result.answer && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Final answer</div>
              <div className="text-sm whitespace-pre-wrap">{result.answer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
