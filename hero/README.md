# 3

TerraLearn — Landing Page Scroll Narrative

Content reference only — no UI/UX direction included, build that however you like. Structured as a sequence of full-scroll scenes, roughly Apple/Stripe/Linear-style product storytelling: one idea per scene, a big line, supporting copy, then the next scene. Every feature is tagged [LIVE] or [VISION] — keep that distinction visible in whatever UI you build. A hackathon/portfolio audience will ask what's real; don't let the page blur that line even where it's tempting.

The arc, briefly

Open on the scale of the problem, not the product — the stakes come before the solution. Then move through the site roughly in the order a farmer would actually experience it: know your land → talk to something that understands it → you're not doing this alone → sell smarter → see trouble before it arrives → protect what you've built. Close on the honesty principle itself as the differentiator, then a forward-looking scene that's allowed to be unapologetically ambitious, clearly marked as where this is going.

Scene 0 — Opening hero

Big line:

One extension officer for every 1,162 farms in India. The recommended ratio is 1 to 400.

Supporting copy: That gap is not a technology problem waiting for an app. It's an information problem, at scale, in a country where the difference between a good season and a ruinous one is often a decision made three weeks too late. TerraLearn is built to close that gap — not by replacing the officer, the agronomist, or the neighbor who's farmed the same soil for thirty years, but by putting real data and a real conversation in a farmer's pocket, in their own language, before the decision has to be made blind.

Tag: framing scene, no feature callouts.

Scene 1 — Know your land

Big line:

Drop a pin. See what's actually true about that ground.

Supporting copy: Soil pH, nitrogen, real air quality, five years of climate history — on a real satellite map, not a cartoon of one. Every number carries its own honesty: a live government reading is shown as exactly that; an estimate is labeled as an estimate; and if the platform genuinely doesn't know something yet for a given spot, it says so instead of guessing. Nothing here is dressed up to look more certain than it is.

Features:

Satellite-based farm mapping, real imagery not a stylized basemap [LIVE]

Soil, climate, and air-quality data with source-labeled honesty (real reading vs. regional estimate vs. no coverage) [LIVE]

Multi-farm support — one farmer, several plots, one dashboard [LIVE]

Real-time CPCB ground-station air quality for India specifically, replacing a modeled global estimate [VISION]

Government Soil Health Card data as the primary India soil source [VISION]

Scene 2 — Ask it anything, in your language

Big line:

The assistant already knows what's on your farm. You don't have to explain it.

Supporting copy: This isn't a chatbot bolted onto a dashboard. It remembers the conversation. It knows the farmer's soil, their crops, their nearby network — who's listed what, who's messaged whom, what circular-agriculture matches exist right now within reach. Ask it who nearby grows paddy and it answers with real names and real distances, not a generic response. And when it drafts a message on a farmer's behalf, nothing is ever sent without a human tapping confirm — not as a promise the model makes, but as an architectural fact: the assistant simply has no ability to send anything on its own.

Features:

Persistent AI assistant, memory across sessions and pages [LIVE]

Fast, plain-language answers in the farmer's own language [LIVE]

Full awareness of the farmer's cooperative network, listings, and matches [LIVE]

Draft-and-confirm messaging — the AI proposes, a human sends [LIVE]

Voice in and voice out, across major Indian languages [VISION]

Proactive advisories at real decision points — spray timing, nutrient windows — not routine reminders nobody needed [VISION]

Scene 3 — You are not farming alone

Big line:

The farmer three villages over already has what you need.

Supporting copy: Circular agriculture, made visible instead of theoretical: paddy straw becomes mushroom substrate, becomes vermicompost, becomes fertilizer back in the same soil it started in. TerraLearn surfaces these loops on the map itself — not a stat in a brochure, a literal line drawn between two real, nearby farms whose waste and whose needs happen to match. Equipment, labour, and resources move the same way: a shared tractor, a harvest crew, a load of compost — found by proximity, trusted by reputation that's actually earned exchange by exchange.

Features:

Hyperlocal cooperative network — equipment, labour, and resource exchange [LIVE]

Circular-agriculture matching engine, visualized directly on the map [LIVE]

Reputation built from real completed exchanges, not self-reported ratings alone [LIVE]

Crop suggestions that weigh circular-agriculture opportunity, not yield alone [LIVE]

Seasonal proactive matching — surfacing a resource before it's even available yet [VISION]

Cooperative-wide circular loops spanning many farms, not just pairs [VISION]

Scene 4 — Sell smarter, not sooner

Big line:

Most farmers don't lose money to a bad harvest. They lose it to a forced sale.

Supporting copy: When there's nowhere to store a harvest and no cash to wait out a bad price, the sale happens the day the price is worst — not a market failure, a liquidity failure. TerraLearn pulls real mandi prices, checks live buyer demand before ever falling back to a static reference number, and tells a farmer plainly which one they're looking at. The vision goes further: verified buyer credentials pulled from the real government tax registry, a payment-reliability score built from actual delivered payments, and a provenance trail a buyer can trust without a middleman vouching for it.

Features:

Real mandi price integration, with historical trend and seasonality signal [LIVE]

Buyer-demand pricing that beats a static reference price whenever a real match exists — fully disclosed either way [LIVE]

No randomized or fabricated pricing anywhere in the pipeline [LIVE]

Verified buyer credentials, checked against the real government tax registry [VISION]

A payment-reliability score, visible before a farmer accepts an offer [VISION]

Transparent, tamper-evident crop-lot provenance from farm to buyer [VISION]

Scene 5 — See the season before it happens

Big line:

A farm is not one risk. It's eight risks that trigger each other.

Supporting copy: A power outage isn't just a power outage — it's an irrigation failure, which is a crop failure, which is a distress sale, which is next season's debt, and each step was foreseeable from the step before it. TerraLearn is building a model of a farm as a living system of dependencies — water, soil, market, credit, power, labour, input, hazard — so a season's risk is visible before it starts, not diagnosed after the damage is already done. And because drought and flood are the two shocks that trigger this cascade most often, the same system is built to translate an official government forecast into one plain, farm-specific instruction: hold, irrigate, harvest early, or wait.

Features:

A season-risk model connecting eight interdependent farm factors [VISION]

Drought detection using the same indices India's own drought-management methodology defines [VISION]

Per-plot flood susceptibility from real terrain data, not a district-wide guess [VISION]

A single, honestly-uncertain recommendation instead of a raw, false-precision score [VISION]

Scene 6 — When something's wrong with the crop

Big line:

A photo of a leaf. An answer that explains itself.

Supporting copy: Point a camera at a damaged leaf and get back more than a name for the disease — a confidence score, a visible highlight of exactly what the model saw, and, when it isn't sure enough, an honest handoff to a real expert instead of a guess dressed up as certainty. Trained not just on tidy lab photographs but on the messy, real conditions a farm actually looks like, because a model that only works in perfect lighting isn't a tool, it's a demo.

Features:

Photo-based disease and pest identification, trained for real field conditions [VISION]

Visual explainability — see exactly what the model is reacting to [VISION]

Automatic escalation to a human expert when confidence is low [VISION]

Fused with soil and weather context into one combined risk read, not an isolated diagnosis [VISION]

Scene 7 — Built on what's already real

Big line:

Every number on this page is either verified, labeled, or admitted as unknown.

Supporting copy: This is the actual differentiator, more than any single feature: TerraLearn never shows a fabricated value as if it were measured. A government reading is shown as one. A model's best estimate is labeled as an estimate. A gap in coverage is disclosed as a gap. That discipline runs through the platform on purpose — because the moment a farmer catches one dishonest number, they stop trusting all the honest ones too. And it's why this platform is built to align with India's own digital agriculture infrastructure — real government data sources, a real national farmer identity system — rather than invent a parallel one.

Features:

A strict data-honesty policy applied across soil, weather, and pricing [LIVE]

No silent fallback values anywhere in the platform [LIVE]

Designed to align with India's national Farmer ID and land-record systems [VISION]

Scheme eligibility (crop insurance, credit, subsidies) surfaced automatically once that integration lands [VISION]

Scene 8 — Closing / what's next

Big line:

This is the platform as it stands today. Here's where it's going.

Supporting copy: Voice, in every major Indian language, so literacy is never the barrier to reaching any of this. A season-risk model that sees trouble coming instead of explaining it afterward. A crop-insurance assistant that knows the one deadline most farmers miss and never guesses at a number it isn't sure of. None of it is vaporware dressed as a roadmap slide — every piece above has a real design, real data sources already identified, and a real reason it isn't built yet, honestly stated. That's the same principle as the whole platform, pointed at its own future instead of its data.

Closing line, standalone:

Built for the ground under it. Not the other way around.

Content reference only. Feature tags [LIVE]/[VISION] should be preserved in whatever visual form the final page takes — that distinction is doing real work, not decoration. i really like https://www.alethia.earth/, if possible make it like that, scrollevent + video play on scroll











## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
