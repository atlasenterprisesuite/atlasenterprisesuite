const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-6-astra';
const MAX_INPUT_CHARS = 32000;
const MAX_MEMORIES = 40;
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
function json(data: unknown, status = 200, extra: Record<string,string> = {}) { return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extra } }); }
function allowedOrigin(req: Request) { const origin = req.headers.get('origin') || ''; const configured = (Deno.env.get('ATLAS_ALLOWED_ORIGINS') || 'https://atlasenterprisesuite.com,https://www.atlasenterprisesuite.com,http://localhost:4173,http://127.0.0.1:4173').split(',').map(v => v.trim()).filter(Boolean); return configured.includes(origin) ? origin : configured[0]; }
function cors(req: Request) { return { 'Access-Control-Allow-Origin': allowedOrigin(req), 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' }; }
function extractOutputText(payload: any) { if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim(); const chunks: string[] = []; for (const item of payload?.output || []) for (const content of item?.content || []) if (typeof content?.text === 'string') chunks.push(content.text); return chunks.join('\n').trim(); }
async function supabaseUserFetch(path: string, authHeader: string, init: RequestInit = {}) { const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); if (!url || !anon) throw new Error('supabase_runtime_not_configured'); return fetch(`${url}${path}`, { ...init, headers: { apikey: anon, Authorization: authHeader, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers || {}) } }); }
async function loadMemory(authHeader: string) { const response = await supabaseUserFetch(`/rest/v1/personal_intelligence_memory?select=namespace,memory_key,memory_type,content&status=eq.active&order=updated_at.desc&limit=${MAX_MEMORIES}`, authHeader, { method: 'GET' }); if (!response.ok) return []; return await response.json(); }
async function logRun(authHeader: string, body: Record<string,unknown>) { try { await supabaseUserFetch('/rest/v1/personal_intelligence_runs', authHeader, { method: 'POST', body: JSON.stringify(body) }); } catch {} }
Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const model = Deno.env.get('ATLAS_OPENAI_ASTRA_MODEL') || DEFAULT_MODEL;
  if (req.method === 'GET') return json({ ok:true, service:'atlas-personal-intelligence', provider:'openai', model, api:'responses', reasoning_effort:'medium' }, 200, corsHeaders);
  if (req.method !== 'POST') return json({ ok:false, error:'method_not_allowed' }, 405, corsHeaders);
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return json({ ok:false, error:'authentication_required' }, 401, corsHeaders);
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ ok:false, error:'provider_not_configured', provider:'openai' }, 503, corsHeaders);
  let payload: any; try { payload = await req.json(); } catch { return json({ ok:false, error:'invalid_json' }, 400, corsHeaders); }
  const input = String(payload?.input || '').trim();
  if (!input) return json({ ok:false, error:'input_required' }, 400, corsHeaders);
  if (input.length > MAX_INPUT_CHARS) return json({ ok:false, error:'input_too_large', maxChars:MAX_INPUT_CHARS }, 413, corsHeaders);
  const memory = await loadMemory(authHeader);
  const startedAt = new Date().toISOString();
  const instructions = 'You are ATLAS Personal Intelligence running on GPT-6 Astra, the authenticated intelligence layer of ATLAS OS. Prioritize accuracy, user intent, privacy, safe execution, and follow-through. Treat supplied ATLAS memory as private contextual data belonging to the signed-in user. Do not expose internal identifiers or stored memory verbatim unless necessary. When uncertain, state uncertainty.';
  try {
    const response = await fetch(OPENAI_ENDPOINT, { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model, instructions, input:[{ role:'user', content:[{ type:'input_text', text:`ATLAS memory context:\n${JSON.stringify(memory)}\n\nUser request:\n${input}` }] }], reasoning:{effort:'medium'}, max_output_tokens:Number(Deno.env.get('OPENAI_MAX_OUTPUT_TOKENS') || 4096), store:false }) });
    const requestId = response.headers.get('x-request-id');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { await logRun(authHeader, { request_id:requestId, route:'atlas-personal-intelligence', model, status:'failed', metadata:{ providerStatus:response.status, startedAt } }); return json({ ok:false, error:'provider_error', provider:'openai', status:response.status, requestId }, 502, corsHeaders); }
    const output = extractOutputText(data);
    await logRun(authHeader, { request_id:requestId, route:'atlas-personal-intelligence', model:data?.model || model, status:'completed', tool_count:0, metadata:{ provider:'openai', startedAt, responseId:data?.id || null } });
    return json({ ok:true, provider:'openai', model:data?.model || model, responseId:data?.id || null, requestId, output, usage:data?.usage || null }, 200, corsHeaders);
  } catch (error) {
    await logRun(authHeader, { route:'atlas-personal-intelligence', model, status:'failed', metadata:{ error:String(error?.message || error), startedAt } });
    return json({ ok:false, error:'provider_unreachable', provider:'openai' }, 502, corsHeaders);
  }
});
