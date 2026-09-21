import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MAX_REQUEST_BYTES = 24 * 1024;
const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

class IntakeError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'apikey, content-type, x-request-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function required(value: unknown, code: string, max: number) {
  const text = clean(value, max);
  if (!text) throw new IntakeError(code, 422);
  return text;
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function reference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `BL360-${date}-${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });

  try {
    if (req.method !== 'POST') throw new IntakeError('method_not_allowed', 405);
    const origin = req.headers.get('origin') || '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) throw new IntakeError('origin_not_allowed', 403);

    const declared = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) throw new IntakeError('request_too_large', 413);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) throw new IntakeError('request_too_large', 413);

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      body = parsed as Record<string, unknown>;
    } catch {
      throw new IntakeError('invalid_json', 400);
    }

    if (clean(body.companyFax, 200)) {
      return json(req, { ok: true, reference: 'received' }, 202);
    }

    const fullName = required(body.fullName, 'full_name_required', 160);
    const email = required(body.email, 'email_required', 240).toLowerCase();
    if (!validEmail(email)) throw new IntakeError('email_invalid', 422);

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new IntakeError('service_unavailable', 503);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: firms, error: firmError } = await admin
      .from('advisory_firms')
      .select('id,org_id')
      .eq('slug', 'aw-finance-advisory-solutions')
      .eq('firm_number', '001')
      .eq('status', 'active')
      .limit(2);

    if (firmError) throw new IntakeError('service_unavailable', 503);
    if (!firms || firms.length !== 1) throw new IntakeError('public_service_configuration_required', 503);

    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await admin
      .from('advisory_launch_intakes')
      .select('id')
      .eq('org_id', firms[0].org_id)
      .eq('firm_id', firms[0].id)
      .eq('email', email)
      .gte('created_at', windowStart)
      .limit(3);
    if (recentError) throw new IntakeError('service_unavailable', 503);
    if ((recent || []).length >= 3) throw new IntakeError('rate_limited', 429);

    const ref = reference();
    const { error } = await admin.from('advisory_launch_intakes').insert({
      org_id: firms[0].org_id,
      firm_id: firms[0].id,
      service_id: 'business-launch-360',
      reference: ref,
      full_name: fullName,
      business_name: clean(body.businessName, 200) || null,
      email,
      phone: clean(body.phone, 80) || null,
      website: clean(body.website, 300) || null,
      business_stage: clean(body.businessStage, 120) || null,
      goals: clean(body.goals, 4000) || null,
      status: 'new',
      quote_currency: 'USD'
    });

    if (error) throw new IntakeError('intake_persistence_failed', 500);
    return json(req, { ok: true, reference: ref }, 201);
  } catch (error) {
    if (error instanceof IntakeError) {
      return json(req, { ok: false, error: error.code }, error.status);
    }
    console.error('atlas-advisory-public unhandled error');
    return json(req, { ok: false, error: 'internal_error' }, 500);
  }
});
