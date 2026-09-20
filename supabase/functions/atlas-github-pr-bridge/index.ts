const REPO = 'atlasenterprisesuite/atlasenterprisesuite';
const OWNER = 'atlasenterprisesuite';
const AUDIENCE = 'atlas-github-pr-bridge';
const WORKFLOW_REF = REPO + '/.github/workflows/atlas-intelligent-issue-router.yml@refs/heads/main';
const GITHUB_API = 'https://api.github.com';
const VERSION = 1;
const BLOCKING_LABELS = new Set([
  'review:human-required',
  'security:sensitive',
  'production:mutation',
  'priority:p0',
]);

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

function b64u(input: string) {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function decodePart(input: string) {
  return JSON.parse(new TextDecoder().decode(b64u(input)));
}

let jwksCache: { until: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function githubKeys() {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const configurationResponse = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' },
  );
  if (!configurationResponse.ok) throw new Error('github_oidc_configuration_unavailable');
  const configuration = await configurationResponse.json();
  const jwksUri = String(configuration?.jwks_uri || '');
  if (!jwksUri.startsWith('https://token.actions.githubusercontent.com/')) {
    throw new Error('github_oidc_configuration_invalid');
  }
  const jwksResponse = await fetch(jwksUri, { cache: 'no-store' });
  if (!jwksResponse.ok) throw new Error('github_oidc_jwks_unavailable');
  const data = await jwksResponse.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOIDC(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false as const, status: 401, error: 'github_oidc_required' };

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return { ok: false as const, status: 401, error: 'invalid_github_oidc' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false as const, status: 401, error: 'unsupported_github_oidc' };
  }

  const jwk = (await githubKeys()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) return { ok: false as const, status: 401, error: 'github_oidc_key_not_found' };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signatureOk = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64u(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]),
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const workflowRef = String(payload.workflow_ref || '');
  const jobWorkflowRef = String(payload.job_workflow_ref || '');
  const workflowAllowed = workflowRef === WORKFLOW_REF || jobWorkflowRef === WORKFLOW_REF;

  if (
    !signatureOk ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30 ||
    payload.repository !== REPO ||
    payload.repository_owner !== OWNER ||
    payload.ref !== 'refs/heads/main' ||
    !workflowAllowed
  ) {
    return { ok: false as const, status: 403, error: 'github_oidc_scope_denied' };
  }

  return {
    ok: true as const,
    claims: {
      sha: String(payload.sha || ''),
      run_id: String(payload.run_id || ''),
      actor: String(payload.actor || ''),
    },
  };
}

function controlToken() {
  return Deno.env.get('ATLAS_GITHUB_TOKEN') || Deno.env.get('GITHUB_TOKEN') || '';
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(GITHUB_API + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + token,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function labelNames(issue: any) {
  return Array.isArray(issue?.labels)
    ? issue.labels.map((label: any) => typeof label === 'string' ? label : String(label?.name || '')).filter(Boolean)
    : [];
}

function eligibleIssue(issue: any) {
  const labels = new Set(labelNames(issue));
  return issue?.state === 'open' &&
    !issue?.pull_request &&
    labels.has('execution:auto-eligible') &&
    ![...BLOCKING_LABELS].some((label) => labels.has(label));
}

async function createDraft(req: Request, caller: Awaited<ReturnType<typeof verifyGitHubOIDC>>) {
  if (!caller.ok) return json({ ok: false, error: caller.error }, caller.status);
  const token = controlToken();
  if (!token) return json({ ok: false, error: 'github_control_token_not_configured' }, 503);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const issueNumber = Number(payload?.issue_number);
  const head = String(payload?.head || '');
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    return json({ ok: false, error: 'invalid_issue_number' }, 400);
  }
  const expectedPrefix = 'atlas/issue-' + issueNumber + '-';
  if (!head.startsWith(expectedPrefix) || !/^atlas\/issue-\d+-[a-z0-9-]{1,64}$/.test(head)) {
    return json({ ok: false, error: 'invalid_work_branch' }, 400);
  }

  const issueResult = await gh(token, '/repos/' + REPO + '/issues/' + issueNumber);
  if (!issueResult.response.ok) {
    return json({ ok: false, error: 'github_issue_read_failed', status_code: issueResult.response.status }, 502);
  }
  const issue = issueResult.body;
  if (!eligibleIssue(issue)) {
    return json({ ok: false, error: 'issue_not_auto_eligible' }, 409);
  }

  const branchResult = await gh(token, '/repos/' + REPO + '/branches/' + encodeURIComponent(head));
  if (!branchResult.response.ok) {
    return json({ ok: false, error: 'github_work_branch_unverified', status_code: branchResult.response.status }, 409);
  }

  const listed = await gh(
    token,
    '/repos/' + REPO + '/pulls?state=open&head=' + encodeURIComponent(OWNER + ':' + head) + '&base=main&per_page=10',
  );
  if (!listed.response.ok) {
    return json({ ok: false, error: 'github_pull_lookup_failed', status_code: listed.response.status }, 502);
  }
  const existing = Array.isArray(listed.body) ? listed.body[0] : null;
  if (existing?.number) {
    return json({
      ok: true,
      created: false,
      pull_request: {
        number: existing.number,
        url: existing.html_url,
        draft: existing.draft === true,
      },
      secrets_returned: false,
    });
  }

  const title = '[AUTO][#' + issueNumber + '] ' + String(issue.title || 'ATLAS work');
  const body = [
    'Tracks #' + issueNumber + '.',
    '',
    'ATLAS Director created this draft PR as the governed workspace for the auto-eligible issue.',
    '',
    '- The source issue remains the requirements source of truth.',
    '- Codex/ATLAS Director may implement on this branch according to routing metadata.',
    '- This draft PR is not completion evidence.',
    '- Do not mark ready or merge until implementation, tests, review, and required governance gates pass.',
    '- Production deployment remains a separate authorized step.',
    '',
    'Bridge evidence: GitHub OIDC run ' + caller.claims.run_id + ' at source SHA ' + caller.claims.sha + '.',
  ].join('\n');

  const created = await gh(token, '/repos/' + REPO + '/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title,
      head,
      base: 'main',
      draft: true,
      body,
    }),
  });

  if (!created.response.ok) {
    return json({
      ok: false,
      error: 'github_pull_create_failed',
      status_code: created.response.status,
      github_message: typeof created.body?.message === 'string' ? created.body.message.slice(0, 160) : null,
    }, 502);
  }

  return json({
    ok: true,
    created: true,
    pull_request: {
      number: created.body.number,
      url: created.body.html_url,
      draft: created.body.draft === true,
    },
    secrets_returned: false,
  }, 201);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');

  if (req.method === 'GET' && api === 'readiness') {
    const token = controlToken();
    if (!token) {
      return json({
        ok: false,
        service: 'atlas-github-pr-bridge',
        version: VERSION,
        github_control_token_configured: false,
        secrets_returned: false,
      }, 503);
    }
    const probe = await gh(token, '/repos/' + REPO);
    return json({
      ok: probe.response.ok,
      service: 'atlas-github-pr-bridge',
      version: VERSION,
      github_control_token_configured: true,
      github_repository_authorized: probe.response.ok,
      status_code: probe.response.status,
      secrets_returned: false,
    }, probe.response.ok ? 200 : 503);
  }

  if (req.method !== 'POST' || api !== 'create-draft') {
    return json({ ok: false, error: 'not_found' }, 404);
  }

  try {
    const caller = await verifyGitHubOIDC(req);
    return await createDraft(req, caller);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    return json({ ok: false, error: message, secrets_returned: false }, 500);
  }
});
