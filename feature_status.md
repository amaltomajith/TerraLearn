TerraLearn — Feature Status Report
Compiled from every planning and build session to date. Legend: ✅ Shipped & verified · 🔧 In progress right now · 📋 Planned, not started · ⚠️ Shipped but flagged for rework

1. Core dashboard
Feature	Status
Crop yield simulator (agronomic model: temp response, GDD, seasonal alignment, soil pH match)	✅
Climate/AQI/5-year trend charts (Open-Meteo)	✅
Soil data (ISRIC SoilGrids)	✅ — but see §11, mislabeled as "live"
Single consolidated Home view (was separate Simulator/Environment tabs)	✅
Crop suggestion as the default path (not dropdown-first)	✅
Onboarding (4 screens: identity, enterprises, farm pin, verify)	✅ — but see §11, sequencing bug
Multi-farm support (FarmSwitcher, save pin as new farm)	✅
2. Data sources & provenance
Source	Status
Open-Meteo (climate, AQI globally)	✅ live
ISRIC SoilGrids (soil, globally)	✅ live
Deterministic seeded soil fallback (replaced random)	✅
"Estimated" disclosure caption on soil fallback	✅
Agmarknet mandi prices (India)	✅ live, VITE_AGMARKNET_API_KEY wired
Buyer-demand-before-reference pricing (priceSource: buyer/agmarknet/reference)	✅
Random price-variation fallback	✅ removed, deterministic reference price now
MarketSignal panel (trend %, seasonality, buyer-vs-reference delta)	✅
CPCB real-time AQI for India (replacing modeled Open-Meteo AQI)	📋 planned, not implemented — still Open-Meteo everywhere
Soil Health Card / real government soil data for India	📋 planned, not implemented — soil is still ISRIC + seeded fallback, not a real India-specific source
Data provenance policy (verified / estimated / no-coverage, no silent fallback)	✅ as a principle, applied to soil + price · 📋 not yet applied to AQI (still modeled everywhere)
3. AI advisory agent
Feature	Status
LangGraph ReAct agent, Groq primary / OpenRouter fallback	✅
Groq model fixed off decommissioned llama-3.3-70b-versatile	✅
404/model-not-found made fallback-eligible	✅
RAG moved off local torch/LlamaIndex to Supabase pgvector	✅ (merged, deploy verification in progress)
Global floating assistant (persistent across all routes)	✅
Conversation memory (Supabase-backed, RLS-protected)	✅
Fast/plain-language answers, farmer's-language reply	✅
Saath read-awareness (inbox, nearby farmers, IFS loops, listings, demand as context)	✅
Draft-and-confirm messaging (AI proposes, human sends — backend has no send capability)	✅
Ambiguous-recipient resolution (refuses silent wrong-match)	✅
Render keep-alive workflow	✅
Multilingual voice (Sarvam AI / Bhashini)	📋 planned, not started
Prioritized advisories at decision points (weather/stage/deficiency-triggered)	📋 planned — see §11, reframed from "chores"
4. Saath (cooperative network)
Feature	Status
Feed, listings (equipment/labour/resource/demand)	✅
Messages	✅
Buyer desk	✅ (UI present; depth of buyer-verification not confirmed)
Disputes	✅ (UI present; depth of resolution flow not confirmed)
Profile, ratings	✅
Payment reliability score (buyer-side)	📋 planned, not built
Buyer GSTIN verification	📋 planned, not built
Harvest-window labour demand curves	📋 planned, needs larger user base first
5. IFS (circular agriculture)
Feature	Status
IFS compatibility matrix	✅
nearby_ifs_matches RPC + grant	✅ verified live
Circular loops on map (toggleable overlay lines)	✅
"Circular loops on your farm" panel (merged, deduped by farmer)	✅
Crop suggestions weighted by circular-agriculture match	✅ (capped boost, doesn't override agronomic fit)
Seasonal IFS calendar (proactive surfacing before resource becomes available)	📋 planned, not started
Collective/cooperative-wide IFS loops (multi-farm)	📋 planned, not started
6. Map & visualization
Feature	Status
MapLibre GL JS (replaced Leaflet entirely)	✅
Satellite basemap (Esri default, Mapbox swap via token)	✅
Streets basemap Mapbox fallback	✅ verified, not just satellite
Layer toggles (Satellite/Streets, Farms, IFS loops)	✅
Onboarding neighbour-preview ("N farmers registered near you")	✅
7. Backend infrastructure
Feature	Status
Supabase (Postgres, Auth via Clerk, RLS, PostGIS)	✅
Multi-farm schema (farms table, primary-farm mirror trigger)	✅
Render deployment	✅ — URL confirmed: terralearn-n3br.onrender.com
Lightweight backend (torch/llama-index dropped)	✅ merged, deploy verification in progress
Role-based access (multiple people per farm, permission levels)	📋 planned — see §11, now reframed as a near-term dependency, not "later"
8. Planned — designed but not started
FarmRisk cascade engine — 8-node dependency graph (water/soil/market/credit/power/labour/input/hazard), season viability score
Flood & drought early warning — SPI, dry-spell detection, soil moisture, HAND flood index, official Drought Manual methodology
Disease & pest vision scanner — 🔧 Phase 1 (on-device scanner: identifies plant + disease from the photo across 14 species, exact CAM overlay, low-confidence refusal) + Phase 2 (scan fused into the AI assistant, pesticide-dosage safety rule) code-complete on `main`; see COMPUTER-VISION.md. Pending: `farm_scans` migration applied (Supabase access), threshold calibration, "not one of these 14 plants" detection, cited disease corpus, and the trained hybrid CNN+ViT — Phase 1 ships a pretrained MobileNetV2 on PlantVillage alone
AgriStack / Bharat-VISTAAR integration — Farmer ID auth, land record autofill, scheme eligibility (mock-first, real access is permissioned)
Blockchain supply-chain traceability — reconsidered mid-project in favor of a Postgres audit-trail pattern; no firm decision made either way
Fasal Sahayak (PMFBY insurance assistant) — separate CIA-3 coursework deliverable, full spec written, not built
Worker/chore role system — brainstormed, reframed this session as roles-schema-first (see §11)
9. Deprioritized / explicitly cut
SkyBridge / Storm Watch integration — cut from the active roadmap; kept only as a mentioned differentiator, not a build item
News/sentiment panel — rejected in favor of MarketSignal (real Agmarknet-derived trend instead of an external news dependency)
10. UX issues identified this session — open, not yet fixed
Onboarding sequencing bug — soil N/P/K and price data can only exist after a farm pin is placed, but the pin is currently the last onboarding step. Needs restructuring to a two-phase flow: "what & where" first (pin + enterprises, triggering background fetches), then "who" (identity fields) collected while a live preview populates alongside.
"Continuous data" is three different things being conflated — polling refresh for weather/AQI (cheap, doable), real IoT sensor telemetry (a different, hardware-dependent roadmap), and soil chemistry mislabeled as "live" when it's a regional interpolation. The soil case is a real trust risk, not just a wording nitpick — needs "regional estimate, updated [date]" labeling, and "continuous" reserved for what's actually continuous.
Role-based access reframed — not a "someday" feature; it's a hard prerequisite for chore-assignment, which can't exist without knowing who a farm's other people are. Reframed as: build the farm_id/user_id/role schema now, even if "owner" is the only role the UI exposes today.
Daily chores reframed — not one unified feature across ten enterprise types (that's N different rule engines wearing one UI); needs scoping to which enterprise ships first. Also reframed from a routine checklist (low value — farmers already know to feed their chickens) to prioritized advisories at genuine decision points, generated from data already on hand (weather thresholds, simulator growth stage, soil deficiency flags).
Report compiled September 2026, mid-session — backend RAG migration to pgvector in progress at time of writing.