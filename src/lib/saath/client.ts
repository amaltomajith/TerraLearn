// Supabase browser client for the Saath slice.
//
// The linchpin of the architecture: every request carries the Clerk session
// token via the `accessToken` option, so Postgres RLS can read
// `auth.jwt() ->> 'sub'` (= the Clerk user id). No Supabase Auth is used.
//
// Requires Clerk to be configured as a Supabase third-party auth provider.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

declare global {
  interface Window {
    Clerk?: {
      session?: { getToken: (opts?: { template?: string }) => Promise<string | null> };
    };
  }
}

let client: SupabaseClient | null = null;

/** The shared Supabase client, or null when env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;

  client = createClient(url as string, anonKey as string, {
    accessToken: async () => {
      try {
        return (await window.Clerk?.session?.getToken()) ?? null;
      } catch {
        return null;
      }
    },
    auth: {
      // Clerk owns the session; disable Supabase's own auth machinery.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}

/** Throwing accessor for call sites that cannot proceed without Supabase. */
export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return c;
}
