# computervision_christy.md
# TerraLearn — CV Integration Brief for Christy

> This document is for the computer-vision engineer joining TerraLearn.
> It describes **what we want the CV feature to feel like and do** from the product side,
> how it connects to the existing platform, and what to expect when you drop your work into it.
> Architecture and model choices are entirely yours. No prescription here.

---

## What we are building (the product vision)

From the landing page (`hero/README.md`, Scene 6):

> "Point a camera at a damaged leaf and get back more than a name for the disease —
> a confidence score, a visible highlight of exactly what the model saw, and, when it
> isn't sure enough, an honest handoff to a real expert instead of a guess dressed up
> as certainty. Trained not just on tidy lab photographs but on the messy, real conditions
> a farm actually looks like, because a model that only works in perfect lighting isn't a
> tool, it's a demo."

That paragraph is the brief. Everything below is how it integrates into what we have built.

---

## Where it lives in the app

TerraLearn already has two major social/data surfaces:

1. **Saath** — the cooperative exchange network. Farmers post listings, find matches,
   message each other. It has a feed, a map, and a trust system.
2. **Dashboard** — per-farm: crop calendar, daily guidelines, AI assistant,
   yield simulator, mandi prices.

The CV scanner should feel like a **third tab/card in Saath** — not buried in settings,
not a separate app. The framing is: "Report what you see, so your neighbours know."

---

## The three things we expect the feature to do

### 1. Scan — identify the problem

- The farmer opens a camera view or uploads a photo from their phone gallery.
- The CV model classifies the image: disease name, pest, nutrient deficiency, or healthy.
- The result shows:
  - The identified issue and the confidence score.
  - A visual highlight or heatmap showing **what in the image triggered the classification**
    (explainability is a hard requirement from the product vision — a black-box answer
    that just says "Leaf blight" is not enough).
  - When confidence is below your chosen threshold: **honest escalation** — "I am not sure.
    Here is what I see. Consider consulting an agronomist." Do not fabricate certainty.
    This is a core TerraLearn data-honesty principle.

### 2. Feed into the RAG (AI assistant context)

This is where the CV layer becomes genuinely more powerful than a standalone scanner.

The platform already has a RAG pipeline in `backend/app/agent.py`. The AI assistant
already knows the farmer's soil, climate, crops, and farm location. When a scan completes:

- The scan result (crop, disease/pest name, confidence, farm location, date) should be
  added to the RAG knowledge store so the assistant can reason about it.
- A farmer should then be able to ask the assistant things like:
  - "What do I do about rice blast on my field?"
  - "Is this disease linked to the recent humidity spike?"
  - "Should I spray now or wait for the rain to pass?"
  - ... and the assistant will already know the farm's soil pH, current temperature,
    recent rainfall, and now also the scan result — giving it everything it needs
    to give a real, contextualised answer rather than a generic one.
- The scan result **does not need to be in the RAG permanently** — even a session-scoped
  injection ("the farmer just scanned this") is enough to make the assistant dramatically
  more useful. Persistent storage per farmer is a nice-to-have for trend analysis.

### 3. Saath disease feed — community early warning

This is the community layer. After a positive identification, the farmer should be offered
a one-tap option: **"Report to your Saath network."**

When they report:
- A post appears in the Saath feed (similar to how listings appear now) saying something like:
  "Ramesha's farm (2.3 km away) reported rice blast on 8 Sep. Confidence: 87%."
- Nearby farmers (within a configurable radius — start with 20 km, same as the existing
  `NEARBY_RADIUS_M` constant in the onboarding) see this in their Saath feed.
- Those nearby farmers can tap the post and open the AI assistant with the context
  pre-loaded: "A farm 2.3 km from yours just reported rice blast. Ask me about
  mitigation strategies." The assistant already knows their soil and climate,
  so it can say things like "Given your current humidity and your paddy at 45 DAS,
  here is the spray window that works for you."

This turns one farmer's scan into a collective early-warning system — which is exactly
the Saath cooperative ethos applied to plant health.

---

## What already exists that you can plug into

| What you need | Where it is | Notes |
|---|---|---|
| The AI assistant / RAG backend | `backend/app/agent.py`, `backend/app/main.py` | FastAPI. Add your scan context as an extra field in the agent's input, or write a new `/api/scan-context` endpoint that the frontend calls after a successful classification to inject context into the next assistant call. |
| The Saath feed | `src/components/saath/` | Listings and messages. Your "disease report" is a new listing type or a new table — either works. Look at `src/lib/saath/queries.ts` for the query patterns. |
| Farm location + soil + climate | Already in context for every signed-in farmer via `useIdentity()` + `climateData` / `soilData` in `home.tsx` | Pass these alongside the image to the inference endpoint so the model (or the backend) can fuse geo-context with the visual result. |
| Supabase (database) | `supabase/10_schema.sql`, migrations in `supabase/migrations/` | RLS on every table. Use `current_farmer_id()` in policies. See `CONTEXT-FOR-CV-LAYER.md` for the full pattern. |
| Nearby farmer radius | `NEARBY_RADIUS_M = 20_000` in `src/components/Onboarding.tsx` | Same logic used for cooperative matching. Farm coordinates are in `farms.lat`, `farms.lng`. |
| Auth | Clerk JWT → Supabase RLS | Every authenticated request already carries the farmer's identity. See `CONTEXT-FOR-CV-LAYER.md §5`. |

---

## Data we want to store per scan (at minimum)

This is a suggestion for the schema — shape it however fits your model output:

```
farm_scans
  id            uuid  primary key
  farmer_id     uuid  references farmers(id)
  farm_id       uuid  references farms(id)
  scan_date     timestamptz
  image_url     text  (or null if not stored — model output only is fine for v1)
  crop          text  (e.g. "Rice")
  diagnosis     text  (e.g. "Rice blast", "Healthy", "Nitrogen deficiency")
  confidence    float (0.0 – 1.0)
  severity      text  (e.g. "mild", "moderate", "severe") — optional
  shared_to_saath  boolean  default false
  lat           float (farm lat at time of scan)
  lng           float (farm lng at time of scan)
  created_at    timestamptz  default now()
```

RLS: a farmer can only read/write their own rows.
Saath feed query: select nearby shared scans within radius using `earth_distance` or
the same haversine logic already in `src/lib/saath/distance.ts`.

---

## What the UI flow looks like (from our end)

We are not prescribing the component structure — that is yours. But the user journey
we expect:

```
Saath tab
  └── [+ Scan] button  (or third tab alongside Feed / Map)
        ↓
  Camera / gallery picker
        ↓
  Inference runs (loading state)
        ↓
  Result card:
    - Diagnosis + confidence
    - Visual explainability overlay on the image
    - "What do I do?" → opens AI assistant with scan context pre-loaded
    - "Report to Saath network" → posts to feed, visible to farms within 20 km
        ↓
  Saath feed shows the disease report
  Nearby farmers see it, tap "Ask assistant" → assistant knows their own farm context
  + the reported disease + proximity
```

---

## Honesty constraints (non-negotiable)

These apply to all of TerraLearn and must apply here too:

1. **Never show a fabricated confidence score.** If the model returns 0.43, show 0.43.
2. **Below your chosen confidence threshold, escalate honestly.** "I am not sure" is a
   valid, correct answer.
3. **The explainability overlay must reflect what the model actually attended to.**
   A fake highlight that always covers the centre of the image is worse than no highlight.
4. **When a disease is reported to Saath, the confidence is shown to neighbours.**
   They deserve to know it was 87%, not treated as certain.

---

## The one integration we care most about

Of the three things above, the one that will make this feel native to TerraLearn rather
than a bolt-on is **#2 — feeding the scan result into the assistant context**.

A farmer who scans a diseased leaf and can immediately turn to the assistant and get
a response like:

> "Based on the rice blast you just identified, your current humidity (84%), and the
> fact that you are 32 days after sowing, the highest-risk window for spread is the next
> 4–6 days. A trifloxystrobin-based fungicide applied in the next 24 hours — before the
> forecasted rain — would give you the best protection…"

...is a completely different experience than a scanner that just says "Rice blast. See a doctor."

That fusion — CV output + soil + climate + crop stage + assistant reasoning — is the
product. Everything else is scaffolding around it.

---

## Questions to answer before you start

See `CONTEXT-FOR-CV-LAYER.md §12` for the full list. The most important ones:

1. On-device inference (ONNX/TFLite) vs. server-side? The backend is on Render free tier
   — cold starts of ~1 min. On-device avoids latency and works offline (important in
   Indian fields). Your call.
2. Which crops and diseases for v1? The platform serves Karnataka farmers primarily
   (paddy, ragi, sugarcane, horticulture, sericulture). Start narrow.
3. Does the scan image get stored, or only the inference result? Storage costs money;
   the result alone is enough for the RAG and Saath feed.

---

*Written 2026-09-08 by the platform team. No architecture imposed. These are expectations,
not instructions. Build it your way — just make these three things work.*
