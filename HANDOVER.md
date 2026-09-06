# TerraLearn — session handover (2026-09-06)

Everything done in this working session, and everything you need to keep going.

---

## TL;DR — current state

- **`main` is at `af4a5bb`.** PR #1 merged the whole Saath feature + the auth/onboarding/
  multi-farm re-architecture; `af4a5bb` is a follow-up blank-screen fix.
- **Production deploy: `terra-learn-tozc.vercel.app`** — live and working (sign-in page renders).
  The other Vercel project `terra-learn-bsz9` was misconfigured (Next.js preset on a Vite
  app) and has been **disconnected** — don't reconnect it.
- **Supabase project `terralearn` / ref `qrkjbdvbehvklaqgotrv`** (ap-south-1) — schema, RLS,
  RPCs, seed data all live and migrated.
- **Clerk** test instance `united-bee-885.clerk.accounts.dev` — connected to Supabase as a
  third-party auth provider (verified working). 12 real persona accounts created.
- `npm run build` and `npx tsc --noEmit` are green. `npm run lint` is broken repo-wide
  (no eslint config — pre-existing, not from this work).

---

## What the app is now

One React app, one Clerk sign-in gate over **both** areas:

| Route | What it is |
|---|---|
| `/sign-in`, `/sign-up` | Clerk widgets (Earthy-themed) |
| `/` (after sign-in + onboarding) | crop-yield **Simulator** — now shows your saved farms + Saath neighbours on the map |
| `/saath/*` | **Saath** — feed, map, listings, messages, buyer desk, disputes, profile |

**Flow:** sign in → if no complete profile, forced to onboarding (name, phone, village,
language, role, enterprises, GSTIN-if-buyer, pin your farm) → then the full app.

**Auth shell** (`src/App.tsx` → `src/auth/`):
- `<ClerkProvider>` at the root (was previously only inside the lazy Saath chunk).
- `RootGate` — `<SignedOut>`→`/sign-in`; `<SignedIn>`→`IdentityProvider`→`RequireOnboarding`→routes.
- `UnconfiguredApp` — shown only if the Clerk/Supabase env vars are missing (a setup message,
  not a blank screen — that's what `af4a5bb` fixed).

**Shared identity** (`src/lib/identity/identity.tsx`): one Clerk user ⇒ one `farmers` row
(looked up by `clerk_user_id`). `src/components/saath/SaathIdentityProvider.tsx` is now a
4-line compat shim so the ~18 Saath components that import `useSaathIdentity` didn't change.
`activeFarmer` is always your own row — no more "view as persona".

**Unified map** (`src/components/MapView.tsx`): replaced both `MapCard` (simulator pin) and
`SaathMap` (Saath markers). Draggable pick-pin + optional read-only neighbour overlay
(circle markers, popup with name / village / distance-from-you / circular badge, click →
their profile). Loads Leaflet only through `src/lib/leaflet.ts`.

**Multi-farm** (`farms` table): a farmer can have several farms. `farmers.location` is kept
as a **trigger-synced mirror of the primary farm**, so every existing proximity RPC works
unchanged. `src/components/FarmSwitcher.tsx` (on the simulator) = dropdown + "update this
farm's location" / "save pin as a new farm" / "set as primary".

**All demo machinery removed:** no `VITE_DEMO_MODE`, no `is_demo()` SQL function or its RLS
branches, no persona switcher / adopt-persona screen, no `personas.ts`, no `DemoDataBadge` /
`ProvenanceNote`, no `farmers.is_seed` column.

---

## Infrastructure

### Supabase — `qrkjbdvbehvklaqgotrv`
Schema files in `supabase/` (`00`–`50` + `seed/51`–`54`) are the v1 baseline; the deltas are
in `supabase/migrations/`:

| Migration | What |
|---|---|
| `20260906_01_farms.sql` | `farms` table, RLS, single-primary + mirror triggers, RPCs (`my_farms`, `add_farm`, `update_farm_location`, `create_profile_with_farm`), backfill |
| `20260906_02_link_baseline_accounts.sql` | sets `clerk_user_id` on the 12 persona rows |
| `20260906_03_drop_demo.sql` | rewrites every `is_demo()` policy without it, drops `is_demo()` + `farmers.is_seed`, recreates `nearby_listings` + `farmer_map_points` |

Earlier in the session (before the re-architecture) the original 9 SQL files (`00_extensions`
→ `seed/53_demo_scenario`) plus a `search_path` hardening pass were also applied live.

**Seed data present:** 12 personas + their 14 headline listings + 1 primary farm each, plus
`seed/53_demo_scenario.sql`'s pre-baked history (7 completed exchanges, 12 ratings, 1 open
dispute) so badges/scores aren't all zero. `RESET.sql` was rewritten to preserve the 12
accounts + their `7777…`-prefixed primary farms on a demo reset.

### Clerk — `united-bee-885.clerk.accounts.dev` (test instance)
- Connected to Supabase (native third-party auth) — RLS reads `auth.jwt() ->> 'sub'`.
- Password sign-in factor enabled.
- 12 persona accounts (see below). The old `demo` session-token claim + `public_metadata.demo`
  are now inert (`is_demo()` is gone) — safe to delete from the dashboard.
- **For a real production domain** you'd create a Clerk *production* instance and swap
  `pk_test_…` → `pk_live_…`.

### Vercel
- **`terra-learn-tozc`** = the live project. Env vars set (Production): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`. Set them as **"Config"** vars —
  the `VITE_` prefix is required (Vite only inlines `VITE_*`), and all three values are
  public-by-design.
- **`terra-learn-bsz9`** = disconnected (was set to Next.js framework preset).
- **Still to do:** set `VITE_API_BASE_URL` on `tozc` to the Render backend URL, or the
  AI panels (`AskTerraLearn`, `EnvironmentalOutlook`) will fail. The rest of the app works
  without it.
- Vite bakes env vars at **build time** — after changing any, you must **redeploy**.

---

## Demo accounts

12 real Clerk accounts, one per persona. Created by `scripts/create-clerk-accounts.mjs`.

- **Emails:** `saath-<slug>+clerk_test@terralearn.dev` (e.g. `saath-chikkamma+clerk_test@terralearn.dev`)
- **Shared password:** in `scripts/.artifacts/saath-demo-logins.md` (gitignored)
- **Email verification code** (Clerk dev instance, `+clerk_test` addresses): always `424242`
- Full persona → email → `clerk_user_id` map: `scripts/.artifacts/persona-clerk-map.json`

Good personas to demo with: **Chikkamma** (sericulture, opens the IFS-loop story),
**Ramesha** (paddy/cattle), **Manjula** (mushroom), **Anwar Silk Traders** (buyer).

To rebuild the accounts: fill `.env.seed-accounts.local` (`CLERK_SECRET_KEY`,
`SEED_ACCOUNT_PASSWORD`, `SEED_EMAIL_DOMAIN`) then
`node --env-file=.env.seed-accounts.local scripts/create-clerk-accounts.mjs`, then apply the
regenerated `scripts/.artifacts/link-baseline-accounts.sql`.

---

## Local dev

```
npm install
# .env.local at the REPO ROOT (not backend/) — already created this session:
#   VITE_API_BASE_URL=http://127.0.0.1:8000
#   VITE_SUPABASE_URL=https://qrkjbdvbehvklaqgotrv.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key>
#   VITE_CLERK_PUBLISHABLE_KEY=pk_test_dW5pdGVkLWJlZS04ODUuY2xlcmsuYWNjb3VudHMuZGV2JA
npm run dev            # http://localhost:5173
```

Backend (unchanged this session): `backend/` FastAPI, `python run_backend.py` or per
`backend/README`. `backend/.env.local` holds real Groq + OpenRouter keys (the two stray
`NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` lines added by mistake were removed).

---

## Key files

| Path | Role |
|---|---|
| `src/App.tsx` | root `ClerkProvider` + env gate + `/sign-in`, `/sign-up`, `/*`→RootGate |
| `src/auth/{RootGate,RequireOnboarding,AuthPages,UnconfiguredApp}.tsx` | auth shell |
| `src/lib/identity/identity.tsx` | shared identity provider (`useIdentity`) |
| `src/lib/identity/isProfileComplete.ts` | onboarding-complete check |
| `src/components/Onboarding.tsx` | the onboarding form → `create_profile_with_farm` RPC |
| `src/components/MapView.tsx` | unified map (pin + neighbour overlay) |
| `src/components/FarmSwitcher.tsx` | multi-farm control on the simulator |
| `src/components/home.tsx` | simulator — seeds pin from primary farm, neighbour overlay, unified nav |
| `src/lib/saath/queries.ts` | all Supabase calls; farms section near the top |
| `src/lib/saath/types.ts` | hand-written DTOs (`Farm` added; `is_seed` removed) |
| `supabase/migrations/*` | the live DB deltas |
| `scripts/create-clerk-accounts.mjs` | persona account provisioning |

---

## Known issues / tech debt

1. **`VITE_API_BASE_URL` not set on Vercel** → AI panels 404 in production. Add the Render URL.
2. **Clerk is a *test* instance** (`pk_test_`) — has strict rate limits, not for real launch.
3. **Main JS bundle is ~1.4 MB** (Clerk now loads on `/` too). Acceptable for a demo; could
   `manualChunks` Clerk/Supabase later.
4. **`npm run lint` is broken** (no eslint config) — pre-existing. `tsc` + `vite build` are
   the real gates.
5. **`src/types/supabase.ts`** is stale (generated types, not imported anywhere). The app uses
   the hand-written `src/lib/saath/types.ts`.
6. **`backend/.env.local`** still has real Groq/OpenRouter keys — rotate before the repo goes
   public.
7. **`.env.seed-accounts.local`** has the Clerk secret key — gitignored, keep it that way.
8. Two untracked scratch files in the repo root (`New Text Document.txt`, `SIH PS's.txt`) —
   yours; not committed.
9. `seed/53_demo_scenario.sql` keeps the old filename though it's now "starter history", not
   a demo scenario.

## Before any public sign-up

- Swap Clerk to a production instance (`pk_live_`), add the real domain to Clerk + Supabase
  third-party auth.
- Decide what onboarding collects for real users vs. the pre-seeded personas.
- Rotate the backend LLM keys; consider auth on the FastAPI backend (currently open, CORS `*`).
- The 12 persona accounts + `seed/53` history are demo fixtures — decide whether they stay.
