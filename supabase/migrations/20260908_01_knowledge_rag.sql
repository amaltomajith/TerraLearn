-- 20260908_01_knowledge_rag.sql
-- Vector search for the AI assistant's environmental knowledge base.
--
-- Replaces the backend's local sentence-transformers + LlamaIndex index, which
-- loaded torch + an 80 MB model into the 512 MB Render free-tier worker and
-- OOM-killed it on the first knowledge lookup. Embeddings are 384-dim from
-- Supabase's built-in gte-small model, served by the `embed` edge function
-- (supabase/functions/embed/) — same model at seed time and query time.
--
-- Seed / re-seed the corpus with backend/scripts/seed_knowledge.py.
-- Mirrored into supabase/10_schema.sql and supabase/30_policies.sql.

create extension if not exists vector;

create table if not exists knowledge_chunks (
  id          bigint generated always as identity primary key,
  source_file text not null,
  content     text not null,
  embedding   vector(384) not null,
  created_at  timestamptz not null default now()
);

-- HNSW cosine index. The corpus is tiny (~34 chunks) so this is instant and,
-- unlike ivfflat, needs no training pass.
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

alter table knowledge_chunks enable row level security;

-- Public reference data: anyone (incl. the backend, via the anon key) may read.
drop policy if exists knowledge_chunks_read on knowledge_chunks;
create policy knowledge_chunks_read on knowledge_chunks
  for select using (true);
-- No write policy — the seed script briefly creates a temporary `_seed_write`
-- policy, then drops it.

create or replace function match_knowledge(
  query_embedding vector(384),
  match_count int default 3
)
returns table (source_file text, content text, similarity float)
language sql
stable
set search_path = public
as $$
  select
    kc.source_file,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function match_knowledge(vector, int) to anon, authenticated;
