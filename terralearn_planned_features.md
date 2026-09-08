# TerraLearn — Designed, Not Yet Started

> Full design context for every feature that's been planned but has no code yet.
> Each section is meant to stand alone — enough background, data sources, and
> guardrails that someone could pick up any one section and start building
> without needing the conversations that produced it.
>
> For what's already shipped, see `terralearn_feature_status.md`.

---

## Priority note, before the sections

The active SIH 2026 anchor is **PS-26132 (Government of Maharashtra) — "Strengthening market linkages and price discovery for farmers."** Its expected-solution text explicitly names: sale-window recommendations, quality grading, verified buyer credentials, payment reliability, and dispute/grievance handling. That means, of everything below, **the Marketplace Trust Layer, the Flood & Drought module (it's what makes sale-window timing credible), and the Disease Scanner (it's the quality-grading requirement) are the highest-leverage builds for that submission** — not just interesting features. AgriStack, voice, and blockchain are real differentiators but not literal PS requirements, and can slot in after the core is solid. Storm Watch is explicitly out of scope for this PS (see its own section).

---

## 1. FarmRisk — cascade risk engine

**What it is:** models a farm as a dependency graph across eight nodes — water, soil, market, credit, power, labour, input, hazard — and propagates a shock along causal edges (a power outage cascades to irrigation loss, to crop stress, to a forced distress sale, to next-season debt) rather than treating each factor in isolation. Output is a single **Season Viability Score** with the top 2–3 named risk drivers, not a wall of raw numbers.

**Why this shape, specifically:** the whole point of the platform's original problem framing was that climate shock and income loss are the *same* problem, connected by a causal chain — this is the module that makes that chain explicit and computable, rather than left as a narrative claim.

**Honesty constraint, non-negotiable:** an early design of this scoring formula was flagged mid-project as violating the platform's own data-provenance policy — an uncalibrated, hand-tuned additive score presented as a precise integer is the same category of dishonesty as the random soil fallback that was already fixed elsewhere. **Do not ship a bare number.** Show a band ("Elevated risk") plus the named drivers, and calibrate edge weights against real historical outcome data (ICRISAT district-level data was the source identified for this) before trusting the score's ranking, not just its direction.

**Node data sources (verify each before wiring):**
- Water: IMD historical monsoon/rainfall data, groundwater depth (see the Flood & Drought section — India-WRIS's public API access is murkier than its website suggests, confirm before relying on it)
- Soil: existing ISRIC SoilGrids / seeded-fallback pipeline, no new source needed
- Market: existing Agmarknet integration, already live
- Credit: **district-level aggregates only** — see the ethics flag below
- Power: state electricity board outage data where available, otherwise skip the node rather than fake a proxy
- Labour, Input: can start as static reference data; real-time versions are a later refinement
- Hazard: the Flood & Drought module below *is* this node, not a separate thing bolted alongside it

**Ethics constraint, non-negotiable:** an early design had the CREDIT node collecting **per-farmer informal debt load**, in a system whose example geography (Vidarbha) is the real-world epicenter of India's farmer-debt crisis. Storing named-individual indebtedness, combined with a distress-signal feature already in the platform, is a genuine misuse target and DPDP Act 2023 territory. **Use district-level aggregate credit indicators only. Never a per-farmer debt figure.**

**Integration points:** WATER/hazard node = the Flood & Drought module directly. MARKET node output should feed the sale-window recommendation already live in MarketSignal. IFS matches already reduce input-cost risk in the intervention-suggestion logic — this was designed as a genuine cross-module link, not a footnote.

**What NOT to build first:** the historical scenario mode ("what would 2015's drought have done to my farm today") and the full IFS-as-intervention UI are real but secondary — the viability score and its top drivers are the MVP; everything else is depth.

---

## 2. Flood & drought early warning + mitigation

**What it is:** two problems with opposite lead times, not one "calamity" feature. Drought builds over weeks to months (rainfall deficit → soil moisture depletion → vegetation stress) and drives **strategic** decisions — crop/variety choice, irrigation planning, insurance enrollment. Flood builds over hours to days (rainfall forecast → river rise) and drives **tactical** decisions — early harvest, moving livestock, damage documentation. Design both around their actual timescale, not a shared generic "risk alert."

**Why not build a custom scoring model:** India already has an official methodology — the **Manual for Drought Management (2016)** — combining rainfall deviation, dry-spell length, vegetation indices (NDVI/VCI), soil moisture index, and reservoir/groundwater status into declared severity classes. Implementing *that* transparently, at a resolution the government itself can't reach at farm level, is the credible move — same logic as everywhere else in this platform: implement the real methodology, don't invent one.

**Data sources, with honest caveats already surfaced:**
- **Drought inputs, mostly already in-house:** SPI-3/SPI-6 computed from Open-Meteo's historical precipitation archive — this data is *already being fetched* for the existing 5-year trend charts; the gap is that nothing is computed from it yet. Soil moisture at depth is also available from Open-Meteo and currently unused. Dry-spell detection during critical growth stages can cross-reference the yield simulator's existing GDD/stage logic.
- **NDVI/VCI:** Sentinel-2 via Google Earth Engine's free tier, or ISRO Bhuvan.
- **Flood — HAND (Height Above Nearest Drainage):** computed from free SRTM/Cartosat DEM data. This gives genuinely per-plot flood susceptibility from terrain alone — static and cheap, and one of the more differentiated pieces of this module since it's farm-specific rather than district-average.
- **IMD** — has a real public API gateway (`api.imd.gov.in`) with district-wise rainfall, cyclone track, and agromet advisory endpoints. Older developer reports describe an IP-whitelisting requirement for access — confirm the current registration flow before assuming zero-friction access.
- **India-WRIS (groundwater)** — the underlying data is real and CGWB-authoritative, but the live-query API story is weaker than it looks: the deeper telemetry system (WIMS) is explicitly "authorized users only," and the public portal was observed serving a default placeholder page during a check, suggesting possible instability. Treat this the same way Soil Health Card was handled — build from downloadable district-level reports rather than betting on a clean coordinate-queryable endpoint.
- **Google Flood Hub** — reportedly has riverine flood forecasting with public API coverage in India; unverified at time of writing, check before committing to it.

**The honest boundary to state in any pitch:** this can't out-forecast IMD — monsoon-onset prediction at village scale is a genuine research problem. What it *can* do is **translate** an official forecast into a farm-specific decision with honest uncertainty: not "will it rain," but "your cotton is at flowering stage, soil moisture is already below threshold, irrigate now or switch to a short-duration variety if you haven't sown."

**Integration points:** this is FarmRisk's hazard node, feeds crop-calendar/sowing-window advice, and is the trigger event for the mitigation side (Saath water-user-association groups, IFS mulching/residue interventions for water retention) — mitigation is the half most teams building something like this forget, and it's what turns this from a weather dashboard into a farmer product.

---

## 3. Disease & pest vision scanner

**Architecture decision, already made:** hybrid CNN+ViT — EfficientNet-B0/B3 or MobileNetV3 backbone for local lesion detection, with a lightweight transformer head for longer-range context. Pure ViTs need more training data than is realistically available to learn the locality a CNN gets for free; pure CNNs alone are faster to ship but weaker on the "why" story judges will ask about.

**The generalization gap to design around, not discover the hard way:** a model trained purely on PlantVillage (lab-condition images) and tested on real-world PlantDoc images has been shown to drop to roughly **68% cross-domain accuracy**. Train on a merged dataset — PlantVillage for scale, PlantDoc for field realism, plus crop-specific sets (tomato/rice leaf disease) — never PlantVillage alone, or the demo will look great and the real product won't.

**Deployment:** export to ONNX/TFLite, quantized, for on-device inference — this matters for the platform's stated rural-connectivity goals, not just performance.

**Non-negotiable UX pieces:**
- Grad-CAM overlay showing which pixels drove the classification — explainability, not decoration
- Visible confidence score
- **Confidence-gated escalation to a human** (KVK extension officer) below a threshold, rather than presenting an uncertain guess as fact — this is the same "verified / estimated / no-coverage" honesty discipline applied to a model output instead of a data reading

**The differentiator, don't skip it:** fuse the scan result with the farm's existing soil and climate data into one **composite risk score and recommendation** — "early blight detected + high humidity forecast + low soil nitrogen → treat within 48 hours" — rather than a standalone plant-ID result. This fusion is the single most defensible claim against Plantix, which doesn't do this combination.

**Integration points:** under PS-26132, this scanner is the **quality grading** requirement, applied at lot-creation time in the marketplace, not just a standalone health check. A confirmed detection should also adjust the yield simulator's prediction, not sit in an isolated tab.

---

## 4. AgriStack / Bharat-VISTAAR integration

**Why this matters more than it looks:** as of a recent check, over 10.31 crore Farmer IDs have been created nationwide, and the Union Budget 2026 explicitly announced **Bharat-VISTAAR** — a multilingual AI platform meant to integrate AgriStack with ICAR's agricultural best-practice packages. That is, close to verbatim, a description of what this platform already is. Framing TerraLearn as a citizen-facing implementation of an active government roadmap item is a stronger pitch than framing it as a standalone app competing with Plantix.

**Reality check on access:** the real Farmer ID / land-record APIs are permissioned to registered government/institutional entities — not open for a student project to call directly. **Mock this convincingly rather than chase real access.** Build the integration point (a login screen accepting a Farmer ID, auto-filling land size/geo-coordinates instead of manual pin-drop, surfacing scheme eligibility for PM-KISAN/PMFBY/KCC) against realistic mock data, and be upfront in any pitch that production access is the documented next step, not something built.

**Integration points:** the land-record autofill directly improves the onboarding flow already being reworked (it removes the manual pin-drop step entirely for a verified farmer). Scheme eligibility surfacing connects to the government-schemes-finder idea and to the Fasal Sahayak insurance assistant's eligibility checks.

---

## 5. Multilingual voice

**Two providers, deliberately, not one:**
- **Sarvam AI** (primary for any working demo) — sub-250ms streaming TTS, 35+ voices, 11 languages including Hindi/English code-switching, ASR that handles code-mixed and noisy real-world audio, free credits, INR pricing.
- **Bhashini** (mention explicitly in any pitch, even if not what's actually demoed) — government-run DPI covering all 22 scheduled Indian languages. Architect behind a swappable provider interface so either can be used — this reads as engineering maturity to judges and avoids a hard vendor lock.

**Why grounding matters here specifically:** voice responses should be generated via retrieval over verified agri-advisory content (the existing RAG corpus, now on pgvector), not free-form generation — incorrect pesticide-dosage advice is a safety problem, not a UX one, and that risk is higher when speech removes the visual double-check a text answer gives a literate user.

**Integration point:** wire directly into the existing global floating assistant — same conversation, same memory, mic becomes an input mode rather than a separate feature or screen.

---

## 6. Marketplace trust layer — payment reliability & buyer verification

**Both pieces map directly onto explicit PS-26132 requirements** ("payment reliability... may be fragmented," "verify... buyer credentials") — this is not a nice-to-have, it's named in the problem statement.

**Payment reliability score — don't build a payment gateway, track reliability instead.** Re-read the actual PS language: it says payment *reliability*, not "process the transaction." A two-sided confirmation (farmer marks payment received, buyer marks payment sent) feeding the same rating/reputation pattern already built for equipment and labour exchanges gives every buyer a visible reliability score before a farmer accepts an offer — sharper and more honest than a payment gateway that would likely be half-faked in any demo anyway.

**Verified buyer credentials — use the real government registry.** GSTN publishes a genuine public **Search-GSTIN API**, no taxpayer authentication required, returning real-time legal name, registration status, and jurisdiction against the actual government tax database. A buyer enters a GSTIN, it comes back real and active or it doesn't — stronger and more honest than any custom KYC flow. **Caveat:** some GSTN access routes go through registered GST Suvidha Providers rather than a fully open call — confirm current terms before committing build time; if it doesn't fit the timeline, ship buyers with a visible "unverified" badge rather than a fabricated checkmark.

**Integration points:** both reuse tables and rating logic that already exist for Saath's equipment/labour exchanges — this is additive to existing schema, not a new system.

---

## 7. IFS & Saath depth features

Three related, smaller features, grouped because they all need a larger real user base before they're meaningful — don't build these before the network has genuine density:

- **Seasonal IFS calendar** — proactively surface a resource match *before* it becomes available (paddy straw only exists post-harvest; poultry litter accumulates year-round) rather than only when something is actively listed.
- **Collective/cooperative-wide IFS loops** — a closed loop across many farms in one cooperative group (ten paddy farmers → three mushroom units → one shared vermicompost facility → back to all ten), rather than one-to-one matches.
- **Harvest-window labour demand curves** — aggregate sowing-declared harvest windows across a taluka into a demand curve, so farmers can see labour-competition peaks and contractors can see where demand concentrates. Genuinely differentiated — no equivalent tool exists — but needs real critical mass of registered farmers to be honest rather than a demo with three data points pretending to be a trend.

---

## 8. Prioritized advisories at decision points (the "chores" reframe)

**This replaced an earlier "daily chores" idea, deliberately.** The original framing had two problems, both worth remembering so they don't creep back in: (1) it wasn't one feature, it was N different rule engines (a paddy chore is stage-based, a poultry chore is an operational routine, a biogas chore is maintenance-cadence-based) wearing one shared UI; (2) routine chores aren't valuable — a farmer already knows to feed their chickens daily, and an app repeating that is noise they'll learn to ignore.

**The reframed version:** prioritized advisories at genuine decision points, generated from data the platform already has — weather thresholds (already in the RAG knowledge corpus), the yield simulator's growth-stage computation, and soil-deficiency flags. "Don't spray today, wind's too high." "Soil N is low and there's a rain window this week — apply now." That's a phrasing-and-prioritization job for the LLM, sitting on top of deterministic threshold logic — **the LLM should never be the thing deciding whether to irrigate; a real agronomic threshold decides that, the LLM explains it in plain language.**

**Scope for v1:** pick one enterprise type to ship first rather than promising all ten from day one — most likely paddy or cotton, since the yield simulator's stage logic already exists for crops, not livestock/aquaculture enterprises.

**The role-schema dependency:** this reframe surfaced a real prerequisite — assigning an advisory or task to someone requires knowing who a farm's other people are. The `farm_workers` schema (farm_id / person / role) needs to exist before assignment logic can, even in a v1 where "owner" is the only role the UI actually uses.

**Safety boundary, carried over from the original brainstorm:** advisories involving a specific pesticide or chemical dosage should require a farmer confirmation tap before reaching anyone else — the same reasoning as the voice module's grounding requirement. Routine/reversible advisories (irrigate, scout, harvest-window reminders) don't need that gate.

---

## 9. Real India-specific data sources (replacing global models)

Two sources, same underlying principle: **replace a global model with a real Indian government source, specifically for India** — this is the exact pattern already applied to soil and pricing, just not yet extended to air quality.

- **CPCB real-time AQI** — via data.gov.in's "Real-time Air Quality Index" resource: 500+ real ground stations, hourly updates. Genuinely superior to Open-Meteo's AQI for India, because Open-Meteo's air-quality figure is itself a model output (CAMS atmospheric composition model), not raw sensor data — same category of thing as ISRIC SoilGrids being a model, not a measurement. Integration pattern: cache the station list, Haversine-match to the nearest station from a farm's pin, and **show which station and how far** rather than pretending it's hyperlocal — a rural pin could genuinely be tens of kilometers from the nearest station, and disclosing that distance is more honest than Open-Meteo's silent interpolation, not less.
- **Soil Health Card-derived reference data** — already identified as more complex than a simple API swap: SHC doesn't expose a clean per-coordinate endpoint, it's built around individual physical farmer cards plus periodically-published district/block aggregate fertility data. The realistic path is building a district/block reference table from those published aggregates, reverse-geocoding a farm's pin to its district/block. This is a data-pipeline task, not a single API integration — scope it accordingly.

**Both should slot into the existing `source` flag pattern** already built for soil data (`isric` / `estimated`) — extend it, don't invent a second labeling system.

---

## 10. Blockchain supply-chain traceability — reconsidered, no firm decision

**Original design:** permissioned ledger (Hyperledger Fabric, not a public chain — no gas fees, matches deployed real-world models), an off-chain Postgres index for fast queries with on-chain hashes as the source of truth, tied to Agmarknet pricing so a verified lot can show it sold at or above fair mandi price.

**Why this is genuinely unresolved, not just deprioritized:** mid-project, while reviewing an unrelated fintech project (Mandate) for reusable patterns, its `traces`-as-spine audit-trail pattern — real, tested, working code with an explicitly disclosed discipline (every panel is a derived view, nothing keeps a silent running total) — was identified as arguably a more reliable answer to "transparent transaction records" than a hackathon-scoped blockchain testnet would be. The tradeoff named at the time: "blockchain" is a stronger word to a judge scanning for buzzwords; an honest audit ledger is a safer bet under time pressure and judge questioning about what's actually real versus demo-only.

**No decision was made either way.** Whoever picks this up should decide: build the real Fabric/testnet version (higher novelty, higher risk of looking shaky under a "is this actually a blockchain" question), or build the Postgres audit-ledger version (lower buzzword value, higher reliability, and reuses a design pattern already proven to work in a related project).

---

## 11. Fasal Sahayak — PMFBY crop insurance assistant

**Separate deliverable, not a TerraLearn feature per se** — built for a CIA-3 coursework assignment (advanced AI assistant requirements: persona, tool use, multimodality, memory/RAG, multi-LLM comparison), but explicitly designed to dock into TerraLearn later as the "Insurance Claim Documentation" feature.

**Full specification already written** — see `pmfby_assistant_spec.md` for the complete design: the 72-hour intimation-window deadline calculator as the centerpiece (missing this deadline is reportedly the single most common cause of claim rejection), a historical-weather cross-check tool via Open-Meteo's Archive API framed to *support* a farmer's account rather than interrogate it, multimodal damage-photo intake, RAG over PMFBY guidelines, and hard persona rules (never estimate loss percentage, never predict claim approval, never embellish a farmer's account). That document is the reference — this entry exists only to flag that it's a real, spec'd, not-yet-built piece of the roadmap, and where to find the details.

---

## 12. Storm Watch / SkyBridge integration — deprioritized, keep as mention only

**Status: explicitly cut from the active build**, not forgotten. A sibling project (SkyBridge, built for a different hackathon — ISRO/Bhuvan Antariksh Hackathon) does physics-informed temporal interpolation of INSAT satellite imagery, turning a 30-minute observation cadence into an effective 7.5-minute one — genuinely strong work, useful for cyclone/convective-storm/hail nowcasting.

**Why it's cut here specifically:** under the PS-26132 (market linkages) anchor, this is a different problem that dilutes a market-linkage pitch rather than strengthening it, and building it well would consume finale hours better spent on the marketplace/trust layer above.

**If revisited later:** the integration boundary already designed was API composition, not a codebase merge — SkyBridge stays its own service, TerraLearn's agent calls it as an external tool the same way it calls Open-Meteo. The reframe worth keeping if this comes back: pitch it as **convective storm and hail nowcasting**, not narrowly "cyclone tracking" — hail and severe thunderstorms are a higher-frequency threat to most Indian farmland than named cyclones, which mostly affect coastal states.

---

*Compiled to stand alone — cross-reference `terralearn_feature_status.md` for what's already shipped, and `pmfby_assistant_spec.md` for the full insurance-assistant design.*
