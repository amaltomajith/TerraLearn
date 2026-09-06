import { hasClerk, hasSupabase } from '@/lib/saath/config';

/**
 * Rendered when the Clerk / Supabase env vars are missing. The whole app is
 * auth-gated, so nothing can run without them — show a clear setup message
 * rather than a blank screen.
 */
export function SetupNeeded() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg bg-card border border-border/60 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h1 className="font-serif text-xl font-bold mb-2">TerraLearn needs configuration</h1>
        <p className="text-sm text-muted-foreground">
          Set these environment variables (Vercel → Project → Settings → Environment
          Variables, or a local <code className="font-mono text-xs">.env.local</code>):
        </p>
        <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
          {!hasClerk && (
            <li>
              <code className="font-mono text-xs">VITE_CLERK_PUBLISHABLE_KEY</code>
            </li>
          )}
          {!hasSupabase && (
            <li>
              <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code>
            </li>
          )}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          See <code className="font-mono text-xs">supabase/README.md</code>. Redeploy after
          adding them.
        </p>
      </div>
    </div>
  );
}

export function UnconfiguredApp() {
  return <SetupNeeded />;
}
