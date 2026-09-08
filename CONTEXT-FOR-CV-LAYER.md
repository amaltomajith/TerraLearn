# CONTEXT-FOR-CV-LAYER.md — TerraLearn CV Engineer Onboarding

> Written: 2026-09-08. Tag key:
> **[REPO]** = verified by reading a file in this repo (path cited).
> **[DASH]** = owner confirmed from a live dashboard (ask before relying).
> **[UNKNOWN]** = nobody has checked yet.
> Never treat a fact from HANDOVER.md as certain — it is a generation stale.

---

## 1. What you are joining

TerraLearn is a mobile-first React + FastAPI app for Indian farmers.

| Feature | Status | Verified at |
|---|---|---|
| Yield simulator (GDD + soil pH) | LIVE | [REPO] `src/components/home.tsx` |
| Data provenance tags (READING/ESTIMATE/GAP) | LIVE | [REPO] `src/lib/api.ts` |
| Mandi price history + live buyer demand | LIVE | [REPO] `src/lib/saath/queries.ts` |
| Saath cooperative exchange | LIVE | [REPO] `src/components/saath/` |
| Farm map (satellite + neighbour overlay) | LIVE | [REPO] `src/components/MapView.tsx` |
| Persistent AI assistant | LIVE | [REPO] `src/lib/assistant/` |
| **Leaf disease scanner (CV)** | **VISION — your work** | [REPO] `hero/README.md` ch.07 |
| FarmRisk cascade engine | VISION | [REPO] `hero/README.md` ch.07 |
| Multilingual voice | VISION | [REPO] `hero/README.md` ch.08 |

---

## 2. CV feature specification

Source: `hero/README.md` chapter 07 — the only spec that exists. [REPO]

```
index:  "07"
kicker: "Next"
title:  "One shock, mapped across eight factors."
body:   "The cascade engine models the farm as a dependency graph —
         a power cut becomes a visible chain of downstream risk."
points: ["FarmRisk cascade engine", "Flood & drought early warning",
         "Leaf disease scanner"]
status: VISION
```

The leaf disease scanner is one of three bullet points under this chapter.
There is no separate spec, no wireframe, no model file.

**What does NOT yet exist in the repo** [REPO]:
- No model weights / ONNX / TFLite file
- No inference endpoint in `backend/app/`
- No camera/upload UI component
- No database table for scan results
- No `/api/scan` route or similar

Everything is your greenfield.

---

## 3. Stack

### Frontend
| | | |
|---|---|---|
| Framework | React 18 + Vite 7 | [REPO] `package.json` |
| Language | TypeScript | [REPO] `tsconfig.json` |
| Routing | react-router-dom v6 | [REPO] `src/App.tsx` |
| Auth | Clerk (`@clerk/clerk-react`) | [REPO] `src/App.tsx` |
| Styling | Tailwind CSS v3 + custom tokens | [REPO] `tailwind.config.js`, `src/index.css` |
| UI primitives | Radix UI + shadcn components | [REPO] `src/components/ui/` |
| Map | MapLibre GL | [REPO] `src/components/MapView.tsx` |

### Backend
| | | |
|---|---|---|
| Framework | FastAPI (Python) | [REPO] `backend/app/main.py` |
| Live endpoints | GET /, GET /health, POST /api/ask, POST /api/risk-brief | [REPO] `backend/app/main.py` |
| LLM | Groq openai/gpt-oss-120b + OpenRouter fallback | [REPO] `render.yaml`, `backend/app/agent.py` |
| Deploy | Render free tier — https://terralearn-n3br.onrender.com | [REPO] `render.yaml` |
| CORS | * (wide open — harden before CV handles images) | [REPO] `backend/app/main.py` |

### Database
| | | |
|---|---|---|
| Provider | Supabase (PostgreSQL) ref qrkjbdvbehvklaqgotrv, ap-south-1 | [REPO] `HANDOVER.md` (verify [DASH]) |
| Auth | Clerk JWT → Supabase RLS via `auth.jwt() ->> 'sub'` | [REPO] `HANDOVER.md` |
| RLS helper | `current_farmer_id()` used in every policy | [REPO] `supabase/30_policies.sql` |
| Key tables | farmers, farms, listings, messages, assistant_threads, assistant_messages | [REPO] `supabase/10_schema.sql` |
| Schema baseline | supabase/00_extensions.sql → supabase/50_realtime.sql | [REPO] |
| Migrations | supabase/migrations/ — numbered YYYYMMDD_NN_*.sql | [REPO] |

---

## 4. Repo layout (paths you need)

```
TerraLearn/
├── src/
│   ├── App.tsx                     # Root routes: / → hero, /* → RootGate
│   ├── auth/
│   │   ├── RootGate.tsx            # Auth boundary + dashboard routes
│   │   ├── AuthPages.tsx           # SignIn / SignUp Clerk widgets
│   │   └── RequireOnboarding.tsx   # Gates app until profile complete
│   ├── components/
│   │   ├── home.tsx                # Yield simulator at /dashboard
│   │   ├── MapView.tsx             # Unified map
│   │   └── saath/                  # Cooperative exchange UI
│   └── lib/
│       ├── identity/identity.tsx   # useIdentity() — signed-in farmer row
│       ├── saath/queries.ts        # All Supabase queries (add yours here)
│       ├── saath/types.ts          # Hand-written TypeScript DTOs
│       └── assistant/              # AssistantProvider, API client, memory
├── backend/
│   └── app/
│       ├── main.py                 # FastAPI app — add CV endpoint here
│       └── agent.py                # LangGraph ReAct agent
├── supabase/
│   ├── 10_schema.sql               # Full table definitions
│   ├── 30_policies.sql             # RLS policies
│   └── migrations/                 # Incremental DB deltas — add yours here
├── public/                         # Static assets served by Vite
├── HANDOVER.md                     # Infra reference (2026-09-06 vintage)
└── SESSION-2026-09-07.md           # Last session log
```

---

## 5. Identity and auth model

```
User signs in (Clerk)
  → JWT sub = clerk_user_id
  → Supabase verifies JWT (third-party auth integration)
  → current_farmer_id() = farmers.id WHERE clerk_user_id = sub
  → ALL RLS policies use current_farmer_id() for row ownership
```

In the frontend: `const { farmer } = useIdentity()` gives you the full
signed-in farmer row (id, name, village, language, enterprises, primary farm).
[REPO] `src/lib/identity/identity.tsx`

**The backend holds no Supabase credentials.** If the CV endpoint writes scan
results, the frontend must make that Supabase write directly using the JS client
— same pattern as assistant memory persistence. [REPO] `backend/app/main.py`

---

## 6. How to add a new backend endpoint

1. Add Pydantic models + `@app.post("/api/your-route")` in `backend/app/main.py`
2. Use `asyncio.to_thread` for any blocking inference (see `/api/ask` pattern)
3. Secrets (model keys, etc.): `backend/.env.local` locally, Render dashboard for prod
4. Frontend calls backend via `VITE_API_BASE_URL` — see `src/lib/assistant/api.ts`
   for the fetch pattern [REPO]

---

## 7. How to add a new frontend route (authenticated)

1. Inside `RootGate.tsx` in the inner `<Routes>` block (inside `RequireOnboarding`
   if a complete profile is needed)
2. `const { farmer } = useIdentity()` for identity
3. Supabase queries → follow pattern in `src/lib/saath/queries.ts`
[REPO] `src/auth/RootGate.tsx`

---

## 8. How to add a new Supabase table

1. Write `supabase/migrations/YYYYMMDD_NN_description.sql`
2. Apply via Supabase MCP or dashboard SQL editor
3. Mirror definition into `supabase/10_schema.sql` and policies into
   `supabase/30_policies.sql` (repo convention) [REPO] `SESSION-2026-09-07.md`
4. All farmer-owned tables MUST have RLS using `current_farmer_id()`
5. Add TypeScript DTOs to `src/lib/saath/types.ts` and query fns to
   `src/lib/saath/queries.ts`

---

## 9. Local dev setup

`.env.local` at the **repo root** (not backend/):

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_dW5pdGVkLWJlZS04ODUuY2xlcmsuYWNjb3VudHMuZGV2JA
VITE_SUPABASE_URL=https://qrkjbdvbehvklaqgotrv.supabase.co
VITE_SUPABASE_ANON_KEY=<ask owner>
VITE_API_BASE_URL=http://127.0.0.1:8000
```

```bash
npm install
npm run dev          # http://localhost:5173
```

Backend (separate terminal):
```bash
cd backend
# backend/.env.local needs OPENAI_API_KEY (Groq) — ask owner
python run_backend.py
```

Demo sign-in:
- Email: `saath-<slug>+clerk_test@terralearn.dev`
- Password: ask owner (gitignored at `scripts/.artifacts/saath-demo-logins.md`)
- Email verification code: always `424242`
- Good accounts: Chikkamma (sericulture), Ramesha (paddy/cattle), Manjula (mushroom)
[REPO] `HANDOVER.md`

---

## 10. Production infrastructure

| Service | URL/ref | Source | Verify |
|---|---|---|---|
| Frontend | terra-learn-tozc.vercel.app | [REPO] HANDOVER.md | [DASH] |
| Backend | https://terralearn-n3br.onrender.com | [REPO] render.yaml | [DASH] |
| Database | Supabase qrkjbdvbehvklaqgotrv (ap-south-1) | [REPO] HANDOVER.md | [DASH] |
| Auth | Clerk test: united-bee-885.clerk.accounts.dev | [REPO] HANDOVER.md | |
| Keep-alive | .github/workflows/keep-render-awake.yml — pings /health every 10 min | [REPO] | |

> HANDOVER.md is from 2026-09-06. Treat every infra value as a claim to
> verify in the live dashboard before relying on it.

---

## 11. Known issues relevant to your work

1. **Backend CORS is `*`** — must harden before CV endpoint handles images. [REPO] `backend/app/main.py`
2. **Clerk is a test instance** (`pk_test_`) — strict rate limits. [REPO] `HANDOVER.md`
3. **`npm run lint` is broken** (no eslint config, pre-existing). Use `npx tsc --noEmit` and `npm run build`. [REPO] `HANDOVER.md`
4. **Render free tier sleeps** ~15 min idle, ~1 min cold start. [REPO] `HANDOVER.md`
5. **`backend/.env.local` holds real LLM keys** — rotate before repo goes public. [REPO] `HANDOVER.md`

---

## 12. Open questions to resolve before you start [UNKNOWN]

1. **Where does CV inference run?** On-device (ONNX/TFLite bundled), server-side on Render, or a dedicated GPU endpoint?
2. **Crops and diseases in scope for v1?**
3. **Image capture flow?** In-browser camera (`getUserMedia`), file upload, or both?
4. **Scan result persistence?** Per-farmer? Per-farm? Which farm does a scan attach to?
5. **Offline requirement?** Indian field connectivity is patchy.
6. **Output format?** Disease name + confidence? Treatment recommendation? AI assistant follow-up?
7. **Model source?** Public checkpoint (PlantVillage, etc.) or custom training data?

---

*Generated 2026-09-08 from live repo reads. Re-verify all infra facts against dashboards.*
