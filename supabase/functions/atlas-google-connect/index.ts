import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  prepareGoogleOAuthAuthorization,
  randomOAuthNonce,
  sha256Base64Url
} from '../_shared/google-oauth.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.atlasenterprisesuite.com',
  'https://atlasenterprisesuite.com'
];

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get('ATLAS_ALLOWED_ORIGINS');
  return new Set(
    (configured ? configured.split(',') : DEFAULT_ALLOWED_ORIGINS)
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function corsHeaders(req: Request): HeadersInit | null {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  if (!allowedOrigins().has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

function json(req: Request, status: number, body: unknown): Response {
  const cors = corsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(cors ?? {}) }
  });
}

function publishableKey(): string {
  const modern = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) {
        return parsed.default.trim();
      }
    } catch {
      // Fall through to the legacy built-in key for backwards compatibility.
    }
  }
  return Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? '';
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (cors === null) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: JSON_HEADERS
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return json(req, 405, { error: 'Method not allowed' });
  }

  const token = bearerToken(req);
  if (!token) return json(req, 401, { error: 'Authentication required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
  const supabaseKey = publishableKey();
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim() ?? '';
  const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')?.trim() ?? '';
  const stateSecret = Deno.env.get('GOOGLE_OAUTH_STATE_SECRET') ?? '';

  if (!supabaseUrl || !supabaseKey) {
    return json(req, 503, { error: 'ATLAS authentication backend is not configured' });
  }
  if (!googleClientId || !googleRedirectUri || stateSecret.trim().length < 32) {
    return json(req, 503, { error: 'Google Workspace integration is not configured' });
  }

  const authorization = `Bearer ${token}`;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return json(req, 401, { error: 'Invalid or expired ATLAS session' });
  }

  let body: { organizationId?: unknown; permissions?: unknown };
  try {
    body = (await req.json()) as { organizationId?: unknown; permissions?: unknown };
  } catch {
    return json(req, 400, { error: 'Invalid JSON body' });
  }

  if (!isUuid(body.organizationId)) {
    return json(req, 400, { error: 'Valid organizationId is required' });
  }
  if (!Array.isArray(body.permissions) || !body.permissions.every((value) => typeof value === 'string')) {
    return json(req, 400, { error: 'Google permissions must be a string array' });
  }

  const { data: canManage, error: permissionError } = await supabase.rpc(
    'has_identity_permission',
    { o: body.organizationId, p: 'integrations.manage' }
  );

  if (permissionError) {
    return json(req, 500, { error: 'Unable to verify ATLAS integration permission' });
  }
  if (canManage !== true) {
    return json(req, 403, { error: 'integrations.manage permission is required' });
  }

  try {
    const now = Date.now();
    const nonce = randomOAuthNonce();
    const prepared = await prepareGoogleOAuthAuthorization({
      clientId: googleClientId,
      redirectUri: googleRedirectUri,
      stateSecret,
      userId: user.id,
      organizationId: body.organizationId,
      permissions: body.permissions,
      nonce,
      now
    });

    const nonceHash = await sha256Base64Url(nonce);
    const { error: stateError } = await supabase.from('atlas_oauth_states').insert({
      org_id: body.organizationId,
      user_id: user.id,
      provider: 'google',
      nonce_hash: nonceHash,
      requested_permissions: prepared.permissions,
      expires_at: new Date(prepared.expiresAt).toISOString()
    });

    if (stateError) {
      return json(req, 500, { error: 'Unable to initialize secure Google OAuth state' });
    }

    return json(req, 200, {
      provider: 'google',
      authorizationUrl: prepared.authorizationUrl,
      expiresAt: prepared.expiresAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Google authorization request';
    return json(req, 400, { error: message });
  }
});
