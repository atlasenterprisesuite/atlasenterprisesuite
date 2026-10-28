/**
 * Server-only, unmounted PostgREST identity directory for the isolated ChatGPT MCP resource.
 *
 * This does not enable a public route. It must be given a trusted server-only credential,
 * and its grant table must be provisioned in a controlled environment before use.
 * Access is bound to a server-issued (subject,jti) grant AND a live active membership.
 * Never use JWT tenant_id/organization_id or client-supplied org values to pick a tenant.
 */
export interface AtlasChatGptSupabaseDirectoryOptions {
  /** Exact, trusted OAuth issuer. Every authorization grant is scoped to this issuer. */
  issuer: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  /** Mandatory live check against a trusted issuer-owned session ledger (no JWT-only inference). */
  verifyIssuerSession: (subject: string, tokenId: string) => Promise<boolean>;
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  nowSeconds?: () => number;
}
export interface AtlasChatGptSupabaseDirectory {
  resolveIdentity: (subject: string, tokenId: string) => Promise<{ tenantId: string; organizationId: string; active: boolean } | null>;
  isRevoked: (tokenId: string, subject: string) => Promise<boolean>;
}

type Grant = {
  issuer: string; subject: string; token_id: string; user_id: string; org_id: string;
  expires_at: string; revoked_at: string | null; session_revoked_at: string | null;
};
type Membership = { user_id: string; org_id: string; status: string };
type Organization = { id: string; active: boolean };
const uuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(s);
const opaque = (s: unknown): s is string =>
  typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);

/** Pure composition root: no outbound requests until the returned methods are called. */
export function createAtlasChatGptSupabaseDirectory(options: AtlasChatGptSupabaseDirectoryOptions): AtlasChatGptSupabaseDirectory {
  const root = new URL(options.supabaseUrl);
  const issuer = new URL(options.issuer);
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash ||
      issuer.href.replace(/\/$/, '') !== options.issuer ||
      root.protocol !== 'https:' || root.username || root.password || root.pathname !== '/' ||
      root.search || root.hash || !root.hostname || !options.serviceRoleKey?.trim() ||
      typeof options.verifyIssuerSession !== 'function')
    throw new Error('trusted_server_supabase_configuration_required');

  const request = options.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const base = root.origin;
  const now = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const read = async (table: string, columns: string[], filters: Record<string,string>): Promise<unknown[] | null> => {
    const url = new URL('/rest/v1/' + table, base);
    url.searchParams.set('select', columns.join(','));
    for (const [key,value] of Object.entries(filters)) url.searchParams.set(key, 'eq.' + value);
    url.searchParams.set('limit', '2'); // Duplicate records always fail closed.
    const response = await request(url.href, {
      method: 'GET', cache: 'no-store', redirect: 'error',
      headers: { apikey: options.serviceRoleKey, Authorization: 'Bearer ' + options.serviceRoleKey, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const rows: unknown = await response.json();
    return Array.isArray(rows) ? rows : null;
  };

  const resolveIdentity = async (subject: string, tokenId: string) => {
    try {
      if (!opaque(subject) || !opaque(tokenId)) return null;
      // A signed JWT or an unrevoked local grant alone cannot establish an active session.
      if (await options.verifyIssuerSession(subject, tokenId) !== true) return null;
      const records = await read('atlas_chatgpt_oauth_grants',
        ['issuer','subject','token_id','user_id','org_id','expires_at','revoked_at','session_revoked_at'],
        { issuer:options.issuer,subject,token_id:tokenId });
      if (records?.length !== 1) return null;
      const g = records[0] as Grant;
      const expiry = typeof g.expires_at === 'string' ? Date.parse(g.expires_at) : NaN;
      if (g.issuer !== options.issuer || g.subject !== subject || g.token_id !== tokenId || !uuid(g.user_id) || !uuid(g.org_id) ||
          g.revoked_at !== null || g.session_revoked_at !== null ||
          !Number.isFinite(expiry) || expiry <= now()*1000) return null;
      const memberships = await read('organization_members',['org_id','user_id','status'],
        {user_id:g.user_id,org_id:g.org_id,status:'active'});
      if (memberships?.length !== 1) return null;
      const m = memberships[0] as Membership;
      if (m.user_id !== g.user_id || m.org_id !== g.org_id || m.status !== 'active') return null;
      const organizations = await read('organizations',['id','active'],{id:g.org_id});
      if (organizations?.length !== 1) return null;
      const org = organizations[0] as Organization;
      if (org.id !== g.org_id || org.active !== true) return null;
      // This isolated slice uses the existing ATLAS Ride compatibility binding tenantId=orgId.
      return {tenantId:g.org_id,organizationId:g.org_id,active:true as const};
    } catch {
      return null; // Includes unavailable PostgREST, malformed JSON, and configuration drift.
    }
  };
  const isRevoked = async (tokenId: string, subject: string): Promise<boolean> =>
    (await resolveIdentity(subject, tokenId)) === null; // Live recheck; no positive permission cache.
  return { resolveIdentity, isRevoked };
}
