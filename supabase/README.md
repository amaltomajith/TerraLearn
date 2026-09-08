# Saath + IFS + Marketplace — database

Postgres + PostGIS on Supabase (free tier). The browser talks to Supabase
directly; **Clerk** is the identity layer, wired in as a Supabase third-party
auth provider. All security is in `30_policies.sql` (+ the migrations) as RLS.

The whole app (the crop simulator *and* Saath) is auth-gated behind one Clerk
sign-in, and every user completes one onboarding that creates their `farmers`
row plus their first `farms` row.

## One-time setup

1. **Clerk app** → copy the publishable key into `VITE_CLERK_PUBLISHABLE_KEY`.
2. Clerk → **Connect with Supabase** (native third-party auth). Fallback: a JWT
   template named `supabase`.
3. Clerk → **User & Authentication** → enable **Password** as a sign-in factor
   (needed for the seeded persona logins).
4. Supabase → **Authentication → Third-Party Auth → add Clerk** (Clerk domain).
5. Supabase → **Database → Extensions** → enable `postgis` and `pgcrypto`
   (or just run `00_extensions.sql` first).

## Run order (Supabase SQL editor)

Fresh database — numbered files first, then the migrations, then the seeds:

```
00_extensions.sql
10_schema.sql
20_helpers.sql
30_policies.sql
40_functions.sql
50_realtime.sql
migrations/20260906_01_farms.sql
migrations/20260906_03_drop_demo.sql
migrations/20260907_01_grant_read_rpcs.sql
migrations/20260907_02_nearby_demand_listings.sql
migrations/20260907_03_assistant_memory.sql
migrations/20260908_01_knowledge_rag.sql
migrations/20260908_02_farm_members.sql
seed/51_ifs_matrix.sql
seed/52_personas.sql
seed/54_farms.sql
seed/53_demo_scenario.sql
```

Then create the 12 Clerk accounts and link them:

```
node --env-file=.env.seed-accounts.local scripts/create-clerk-accounts.mjs
# then apply the generated scripts/.artifacts/link-baseline-accounts.sql
# (checked in as migrations/20260906_02_link_baseline_accounts.sql)
```

Confirm with snippets from `99_debug.sql`.

## Repeatable demos

`RESET.sql` wipes transactional data (messages / offers / exchanges / ratings /
disputes / listings / cooperatives / test farms) but keeps the schema,
`ifs_matrix`, the 12 persona rows and their Clerk links. Re-run
`52_personas.sql` → `54_farms.sql` → `53_demo_scenario.sql` after it.

## The personas

10 fictional farmers + 2 buyers around **Mandya town, Karnataka**
(12.5223 N, 76.8954 E), in 3 village clusters spanning ~18 km. Each is a **real
Clerk account** (shared password, see `scripts/.artifacts/saath-demo-logins.md`).

| id suffix | name | enterprises | cluster |
|---|---|---|---|
| `…001` | Ramesha Gowda | paddy, cattle | Keragodu |
| `…002` | Lakshmamma | cattle, biogas | Keragodu |
| `…003` | Suresh Kumar | poultry | Kyathanahalli |
| `…004` | Prakash | (harvest labour) | Keragodu |
| `…005` | Manjula | mushroom | Basaralu |
| `…006` | Kariyappa | vermicompost | Basaralu |
| `…007` | Devaraju | horticulture | Chikkarasinakere |
| `…008` | Nagaraj | fishpond | Duddagere |
| `…009` | Basavaraju | sugarcane, ragi | Kottathi |
| `…010` | Chikkamma | sericulture | Duddagere |
| buyer `…001` | Anwar Silk Traders | — | Ramanagara |
| buyer `…002` | Mandya Vegetable FPO | horticulture | Mandya |

Closed IFS loop: Ramesha paddy straw → Manjula mushroom → spent substrate →
Kariyappa vermicompost → Devaraju horticulture → vegetable waste → back to
Kariyappa; dung/manure from Lakshmamma & Suresh → Nagaraj fishpond → pond silt →
Ramesha's paddy; Basavaraju's cane tops & ragi straw → Lakshmamma's cattle.
