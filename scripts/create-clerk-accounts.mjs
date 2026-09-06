// Provision one real Clerk account per Saath seed persona.
//
//   node --env-file=.env.seed-accounts.local scripts/create-clerk-accounts.mjs
//
// Env: CLERK_SECRET_KEY, SEED_ACCOUNT_PASSWORD, SEED_EMAIL_DOMAIN
//
// Idempotent: an existing account for a persona's email is reused, not recreated.
// Outputs (gitignored):
//   scripts/.artifacts/persona-clerk-map.json   { persona_id, clerk_user_id, email }[]
//   scripts/.artifacts/saath-demo-logins.md     human credentials table
//   scripts/.artifacts/link-baseline-accounts.sql   UPDATE farmers ... (apply via Supabase)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, '.artifacts');

const SECRET = process.env.CLERK_SECRET_KEY;
const PASSWORD = process.env.SEED_ACCOUNT_PASSWORD;
const DOMAIN = process.env.SEED_EMAIL_DOMAIN || 'terralearn.dev';

if (!SECRET || !PASSWORD) {
  console.error('Missing CLERK_SECRET_KEY or SEED_ACCOUNT_PASSWORD. Pass them via --env-file=.env.seed-accounts.local');
  process.exit(1);
}

// persona_id must match supabase/seed/52_personas.sql exactly.
const PERSONAS = [
  { id: '11111111-1111-1111-1111-000000000001', first: 'Ramesha', last: 'Gowda', slug: 'ramesha' },
  { id: '11111111-1111-1111-1111-000000000002', first: 'Lakshmamma', last: '(Keragodu)', slug: 'lakshmamma' },
  { id: '11111111-1111-1111-1111-000000000003', first: 'Suresh', last: 'Kumar', slug: 'suresh' },
  { id: '11111111-1111-1111-1111-000000000004', first: 'Prakash', last: '(Keragodu)', slug: 'prakash' },
  { id: '11111111-1111-1111-1111-000000000005', first: 'Manjula', last: '(Basaralu)', slug: 'manjula' },
  { id: '11111111-1111-1111-1111-000000000006', first: 'Kariyappa', last: '(Basaralu)', slug: 'kariyappa' },
  { id: '11111111-1111-1111-1111-000000000007', first: 'Devaraju', last: '(Chikkarasinakere)', slug: 'devaraju' },
  { id: '11111111-1111-1111-1111-000000000008', first: 'Nagaraj', last: '(Duddagere)', slug: 'nagaraj' },
  { id: '11111111-1111-1111-1111-000000000009', first: 'Basavaraju', last: '(Kottathi)', slug: 'basavaraju' },
  { id: '11111111-1111-1111-1111-000000000010', first: 'Chikkamma', last: '(Duddagere)', slug: 'chikkamma' },
  { id: '22222222-2222-2222-2222-000000000001', first: 'Anwar', last: 'Silk Traders', slug: 'anwar' },
  { id: '22222222-2222-2222-2222-000000000002', first: 'Mandya', last: 'Vegetable FPO', slug: 'mandya-fpo' },
];

const API = 'https://api.clerk.com/v1';
const headers = { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

// `+clerk_test` addresses never send real email and are safe on any domain.
const emailFor = (p) => `saath-${p.slug}+clerk_test@${DOMAIN}`;

async function findUser(email) {
  const res = await fetch(`${API}/users?email_address=${encodeURIComponent(email)}&limit=1`, { headers });
  if (!res.ok) throw new Error(`list users ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createUser(p) {
  const res = await fetch(`${API}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email_address: [emailFor(p)],
      password: PASSWORD,
      first_name: p.first,
      last_name: p.last,
      skip_password_checks: true,
      skip_legal_checks: true,
    }),
  });
  if (!res.ok) throw new Error(`create user ${res.status}: ${await res.text()}`);
  return res.json();
}

const out = [];
for (const p of PERSONAS) {
  const email = emailFor(p);
  let user = await findUser(email);
  if (user) {
    console.log(`= exists  ${email}  ->  ${user.id}`);
  } else {
    user = await createUser(p);
    console.log(`+ created ${email}  ->  ${user.id}`);
  }
  out.push({ persona_id: p.id, clerk_user_id: user.id, email });
}

mkdirSync(ARTIFACTS, { recursive: true });

writeFileSync(join(ARTIFACTS, 'persona-clerk-map.json'), JSON.stringify(out, null, 2) + '\n');

const md = [
  '# Saath demo logins',
  '',
  `All 12 accounts share one password: \`${PASSWORD}\``,
  '',
  '| Persona | Email | Clerk user id |',
  '|---|---|---|',
  ...out.map((r) => {
    const p = PERSONAS.find((x) => x.id === r.persona_id);
    return `| ${p.first} ${p.last} | ${r.email} | ${r.clerk_user_id} |`;
  }),
  '',
].join('\n');
writeFileSync(join(ARTIFACTS, 'saath-demo-logins.md'), md);

const sql = [
  '-- Apply via Supabase (MCP apply_migration or SQL editor). Idempotent.',
  ...out.map(
    (r) => `update farmers set clerk_user_id = '${r.clerk_user_id}' where id = '${r.persona_id}';`,
  ),
  '',
].join('\n');
writeFileSync(join(ARTIFACTS, 'link-baseline-accounts.sql'), sql);

console.log(`\nWrote ${out.length} rows to scripts/.artifacts/ (map JSON, logins MD, link SQL).`);
