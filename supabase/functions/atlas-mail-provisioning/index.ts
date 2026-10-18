import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const ALLOWED_ORIGINS = new Set(['https://atlasenterprisesuite.com', 'https://www.atlasenterprisesuite.com']);

type Context = { userId: string; orgId: string };
type CloudflareConfig = { token: string; accountId: string; zoneId: string; domain: string; destination: string };

class MailError extends Error {
  constructor(readonly code: string, readonly status = 400, readonly details: Record<string, unknown> = {}) {
    super(code);
  }
}

function clean(value: unknown, max = 200) { return String(value ?? '').trim().slice(0, max); }
function cors(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'Origin'
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...cors(req.headers.get('origin'))
    }
  });
}
function userClient(req: Request) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}
async function context(req: Request): Promise<Context> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new MailError('supabase_runtime_not_configured', 503);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new MailError('authentication_required', 401);
  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new MailError('invalid_session', 401);
  const orgId = clean(req.headers.get('x-atlas-org-id'), 80);
  if (!orgId) throw new MailError('active_organization_required', 403);
  const { data: membership, error: membershipError } = await sb.from('organization_members')
    .select('org_id').eq('user_id', data.user.id).eq('org_id', orgId).eq('status', 'active').maybeSingle();
  if (membershipError || !membership) throw new MailError('active_organization_required', 403);
  const { data: allowed, error: permissionError } = await sb.rpc('has_identity_permission', { o: orgId, p: 'integrations.manage' });
  if (permissionError || allowed !== true) throw new MailError('authorization_denied', 403);
  return { userId: data.user.id, orgId };
}
function config(): CloudflareConfig | null {
  const token = clean(Deno.env.get('CLOUDFLARE_API_TOKEN'), 4096);
  const accountId = clean(Deno.env.get('CLOUDFLARE_ACCOUNT_ID'), 80);
  const zoneId = clean(Deno.env.get('CLOUDFLARE_ZONE_ID'), 80);
  const domain = clean(Deno.env.get('ATLAS_MAIL_DOMAIN') || 'atlasenterprisesuite.com', 253).toLowerCase();
  const destination = clean(Deno.env.get('ATLAS_MAIL_FORWARD_TO'), 320).toLowerCase();
  return token && accountId && zoneId && domain && destination
    ? { token, accountId, zoneId, domain, destination }
    : null;
}
async function cloudflare(cfg: CloudflareConfig, path: string, init: RequestInit = {}) {
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new MailError('cloudflare_request_failed', 502, { provider_status: response.status });
  }
  return payload;
}
async function verify(cfg: CloudflareConfig) {
  try {
    const [zone, settings, destinations] = await Promise.all([
      cloudflare(cfg, `/zones/${cfg.zoneId}`),
      cloudflare(cfg, `/zones/${cfg.zoneId}/email/routing`),
      cloudflare(cfg, `/accounts/${cfg.accountId}/email/routing/addresses`)
    ]);
    const domainMatches = String(zone.result?.name || '').toLowerCase() === cfg.domain;
    const routingEnabled = settings.result?.enabled === true;
    const destination = (destinations.result || []).find(
      (item: { email?: string }) => String(item.email || '').toLowerCase() === cfg.destination
    );
    const destinationVerified = Boolean(destination?.verified);
    const blocker = !domainMatches
      ? 'zone_domain_mismatch'
      : !routingEnabled
        ? 'email_routing_disabled'
        : !destinationVerified
          ? 'destination_unverified'
          : null;
    return { verified: blocker === null, destinationVerified, blocker };
  } catch {
    return { verified: false, destinationVerified: false, blocker: 'provider_verification_failed' };
  }
}
function validLocalPart(value: unknown) {
  const part = clean(value, 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/.test(part) || part.includes('..')) {
    throw new MailError('invalid_local_part', 400);
  }
  return part;
}
async function listRules(cfg: CloudflareConfig) {
  return (await cloudflare(cfg, `/zones/${cfg.zoneId}/email/routing/rules`)).result || [];
}
async function provisionOne(cfg: CloudflareConfig, localPart: string, existing: Array<Record<string, unknown>>) {
  const address = `${localPart}@${cfg.domain}`;
  const found = existing.find(
    (rule) => Array.isArray(rule.matchers) &&
      (rule.matchers as Array<{ value?: string }>).some((matcher) => matcher.value === address)
  );
  if (found) return { address, status: 'existing' as const };
  await cloudflare(cfg, `/zones/${cfg.zoneId}/email/routing/rules`, {
    method: 'POST',
    body: JSON.stringify({
      name: `ATLAS ${localPart}`,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: address }],
      actions: [{ type: 'forward', value: [cfg.destination] }]
    })
  });
  return { address, status: 'created' as const };
}
async function audit(ctx: Context, action: string, data: unknown) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  try {
    await admin.from('audit_logs').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action,
      table_name: 'atlas_mail_aliases',
      record_id: null,
      new_data: data
    });
  } catch {
    // Provider state is authoritative; audit failure never fabricates success.
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(req.headers.get('origin')) });
  }
  try {
    const api = new URL(req.url).searchParams.get('api');
    const ctx = await context(req);
    const cfg = config();
    if (api === 'readiness' && req.method === 'GET') {
      if (!cfg) {
        return json(req, {
          ok: true,
          service: 'atlas-mail-provisioning',
          organization_id: ctx.orgId,
          state: 'pending_provider',
          blocker: 'cloudflare_mail_configuration_incomplete',
          provider: null,
          provider_verified: false,
          provisioning_enabled: false,
          domain: 'atlasenterprisesuite.com',
          destination_configured: false,
          destination_verified: false,
          secret_values_returned: false,
          checked_at: new Date().toISOString()
        });
      }
      const evidence = await verify(cfg);
      return json(req, {
        ok: true,
        service: 'atlas-mail-provisioning',
        organization_id: ctx.orgId,
        state: evidence.verified ? 'ready' : 'configured_unverified',
        blocker: evidence.blocker,
        provider: 'cloudflare',
        provider_verified: evidence.verified,
        provisioning_enabled: evidence.verified,
        domain: cfg.domain,
        destination_configured: true,
        destination_verified: evidence.destinationVerified,
        secret_values_returned: false,
        checked_at: new Date().toISOString()
      });
    }
    if (api === 'bulk-provision' && req.method === 'POST') {
      if (!cfg) throw new MailError('cloudflare_mail_configuration_incomplete', 503);
      const evidence = await verify(cfg);
      if (!evidence.verified) {
        throw new MailError('provider_not_verified', 503, { blocker: evidence.blocker });
      }
      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body.local_parts) || body.local_parts.length < 1 || body.local_parts.length > 40) {
        throw new MailError('invalid_alias_batch', 400);
      }
      const localParts = [...new Set(body.local_parts.map(validLocalPart))];
      const existing = await listRules(cfg);
      const results = [];
      for (const localPart of localParts) {
        try {
          results.push(await provisionOne(cfg, localPart, existing));
        } catch (error) {
          results.push({
            address: `${localPart}@${cfg.domain}`,
            status: 'failed',
            error: error instanceof MailError ? error.code : 'provider_error'
          });
        }
      }
      await audit(ctx, 'connect.mail.aliases.provisioned', { results });
      return json(req, { ok: true, results });
    }
    throw new MailError('not_found', 404);
  } catch (error) {
    const normalized = error instanceof MailError ? error : new MailError('internal_error', 500);
    return json(req, { ok: false, error: normalized.code, ...normalized.details }, normalized.status);
  }
});
