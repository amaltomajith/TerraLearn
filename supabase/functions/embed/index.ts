import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Supabase's built-in 384-dim embedding model — runs in the edge runtime, no
// external API key. Used for both seeding knowledge_chunks (backend/scripts/
// seed_knowledge.py) and query-time retrieval by the TerraLearn assistant
// backend (backend/app/rag.py). Deployed with verify_jwt=true; callers pass the
// anon key as the Bearer token.
const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const input = body?.input;
    if (typeof input !== "string" || !input.trim()) {
      return new Response(JSON.stringify({ error: "body.input (non-empty string) required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const embedding = await model.run(input, { mean_pool: true, normalize: true });
    return new Response(JSON.stringify({ embedding }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
