import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const MODEL = Deno.env.get('ATLAS_OPENAI_ASTRA_MODEL') || 'gpt-6-astra';
const CACHE_REFRESH_MS = 10 * 60 * 1000;
const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atlasenterprisesuite.com';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-headers': 'authorization, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function userClient(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { authorization } }
  });
}

function adminClient() {
  if (!SERVICE_ROLE_KEY) throw new Error('server_secret_not_configured');
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function outputText(data: any) {
  const out: string[] = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && part?.text) out.push(String(part.text));
    }
  }
  return out.join('\n').trim();
}

async function safetyIdentifier(orgId: string, userId: string) {
  return `atlas_${(await sha256(`${orgId}:${userId}`)).slice(0, 32)}`;
}

async function visibleCount(client: any, table: string, orgId: string) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId);
  return error ? null : (count ?? 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);
  if (!req.headers.get('authorization')) return json(req, { ok: false, error: 'authentication_required' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || '').trim();
    const forceRefresh = body?.force_refresh === true;
    if (!orgId) return json(req, { ok: false, error: 'org_id_required' }, 400);

    const client = userClient(req);
    const { data: userData, error: userError } = await client.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json(req, { ok: false, error: 'invalid_session' }, 401);

    const { data: membership, error: membershipError } = await client
      .from('organization_members')
      .select('org_id, role, status')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError || !membership) return json(req, { ok: false, error: 'organization_access_denied' }, 403);

    const [{ data: bills, error: billsError }, { data: accounts, error: accountsError }] = await Promise.all([
      client
        .from('accounting_bills')
        .select('id,bill_number,bill_date,due_date,amount,balance_due,approval_state,match_state,status')
        .eq('org_id', orgId)
        .order('bill_date', { ascending: false })
        .order('bill_number', { ascending: true })
        .limit(100),
      client
        .from('chart_of_accounts')
        .select('account_number,name,account_type,active')
        .eq('org_id', orgId)
        .order('account_number', { ascending: true })
        .limit(100)
    ]);
    if (billsError) return json(req, { ok: false, error: 'accounting_bills_unavailable' }, 502);
    if (accountsError) return json(req, { ok: false, error: 'chart_of_accounts_unavailable' }, 502);

    const coverageEntries = await Promise.all([
      ['accounting_transactions', visibleCount(client, 'accounting_transactions', orgId)],
      ['invoices', visibleCount(client, 'invoices', orgId)],
      ['accounting_bank_accounts', visibleCount(client, 'accounting_bank_accounts', orgId)],
      ['accounting_reconciliation_items', visibleCount(client, 'accounting_reconciliation_items', orgId)],
      ['sales_orders', visibleCount(client, 'sales_orders', orgId)],
      ['inventory_items', visibleCount(client, 'inventory_items', orgId)]
    ].map(async ([name, pending]) => [name, await pending]));
    const counts = Object.fromEntries(coverageEntries);

    const normalizedBills = (bills || []).map((bill: any) => ({
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      due_date: bill.due_date,
      amount: Number(bill.amount || 0),
      balance_due: Number(bill.balance_due || 0),
      approval_state: bill.approval_state,
      match_state: bill.match_state,
      status: bill.status
    }));
    const normalizedAccounts = (accounts || []).map((account: any) => ({
      account_number: account.account_number,
      name: account.name,
      account_type: account.account_type,
      active: account.active
    }));
    const openBalance = normalizedBills.reduce((sum, bill) => sum + bill.balance_due, 0);
    const snapshot = {
      source: 'supabase_rls_live',
      org_id: orgId,
      ap_bills: normalizedBills,
      chart_of_accounts: normalizedAccounts,
      counts
    };
    const snapshotHash = await sha256(JSON.stringify(snapshot));
    const summary = {
      source: 'supabase_rls_live',
      bill_count: normalizedBills.length,
      open_balance: Number(openBalance.toFixed(2)),
      chart_account_count: normalizedAccounts.length,
      counts
    };

    const admin = adminClient();
    const { data: cached } = await admin
      .from('accounting_ai_insights')
      .select('analysis,response_id,model,snapshot_summary,created_at')
      .eq('org_id', orgId)
      .eq('snapshot_hash', snapshotHash)
      .eq('model', MODEL)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cacheAge = cached?.created_at ? Date.now() - new Date(cached.created_at).getTime() : Number.POSITIVE_INFINITY;
    if (cached && (!forceRefresh || cacheAge < CACHE_REFRESH_MS)) {
      return json(req, {
        ok: true,
        cached: true,
        model: cached.model,
        response_id: cached.response_id,
        generated_at: cached.created_at,
        snapshot: cached.snapshot_summary,
        analysis: cached.analysis,
        execution: { payments: false, journal_entries: false, mutations: false }
      });
    }

    if (!OPENAI_API_KEY) return json(req, { ok: false, error: 'openai_not_configured', snapshot: summary }, 503);

    const instructions = [
      'You are ATLAS Accounting Intelligence for Accounts Payable.',
      'Analyze only the supplied live RLS-scoped snapshot. Never invent missing financial activity, vendors, currency, balances, or dates.',
      'Write in concise Spanish for an executive/operator.',
      'Use exactly four sections with markdown headings: Estado real, Riesgos, Acciones recomendadas, Datos faltantes para producción.',
      'Clearly label actions as recommendations. Do not claim any payment, approval, journal entry, vendor update, or other mutation was executed.',
      'Prioritize approval exceptions, missing purchase orders, due-date gaps, data coverage, reconciliation readiness, and control weaknesses.'
    ].join(' ');

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${OPENAI_API_KEY}`,
        'content-type': 'application/json',
        'OpenAI-Safety-Identifier': await safetyIdentifier(orgId, user.id)
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: JSON.stringify(snapshot),
        reasoning: { effort: 'medium' },
        max_output_tokens: 1400,
        store: false
      })
    });

    const providerData = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      const providerError = openaiResponse.status === 429 ? 'provider_rate_limited' : openaiResponse.status >= 500 ? 'provider_unavailable' : 'provider_error';
      return json(req, { ok: false, error: providerError, snapshot: summary }, openaiResponse.status === 429 ? 429 : 502);
    }
    const analysis = outputText(providerData);
    if (!analysis) return json(req, { ok: false, error: 'empty_provider_output', snapshot: summary }, 502);

    const generatedAt = new Date().toISOString();
    await admin.from('accounting_ai_insights').insert({
      org_id: orgId,
      snapshot_hash: snapshotHash,
      model: providerData.model || MODEL,
      analysis,
      response_id: providerData.id || null,
      bill_count: normalizedBills.length,
      open_balance: Number(openBalance.toFixed(2)),
      snapshot_summary: summary,
      generated_by: user.id,
      created_at: generatedAt
    });

    return json(req, {
      ok: true,
      cached: false,
      model: providerData.model || MODEL,
      response_id: providerData.id || null,
      generated_at: generatedAt,
      snapshot: summary,
      analysis,
      execution: { payments: false, journal_entries: false, mutations: false }
    });
  } catch (error) {
    console.error('atlas_accounting_insight_failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(req, { ok: false, error: 'internal_error' }, 500);
  }
});
