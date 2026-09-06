// Feature-availability flags derived from env. Import these instead of reading
// import.meta.env directly so the checks stay consistent.

export const hasClerk = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export const hasSupabase = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/** Saath needs both auth and a database. */
export const saathReady = hasClerk && hasSupabase;
