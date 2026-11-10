// ATLAS Civilian Sentinel — private, read-only simulation view.
Deno.serve(async (request: Request) => {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  const endpoint = Deno.env.get("SUPABASE_URL");
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!endpoint || !apiKey) return new Response(JSON.stringify({ error: "not_configured" }), { status: 503, headers });
  try {
    const caller = await fetch(endpoint + "/auth/v1/user", { headers: { authorization: auth, apikey: apiKey } });
    if (!caller.ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
    const records = await fetch(endpoint + "/rest/v1/atlas_civilian_simulations?select=id,org_id,scenario,status,created_at&order=created_at.desc&limit=25", { headers: { authorization: auth, apikey: apiKey } });
    if (!records.ok) return new Response(JSON.stringify({ error: "data_unavailable" }), { status: 503, headers });
    return new Response(JSON.stringify({ mode: "SIMULATION_ONLY", public_alerts_enabled: false, records: await records.json() }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), { status: 503, headers });
  }
});
