function fail(code, status = 400, details = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function bearerOf(request) {
  const raw = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(raw)) throw fail('unauthenticated', 401);
  return raw;
}

async function readJson(response, code) {
  if (!response.ok) throw fail(code, response.status >= 500 ? 502 : response.status);
  return response.json();
}

export function hasExecutionPermission(context, required) {
  const permissions = Array.isArray(context?.permissions) ? context.permissions : [];
  if (permissions.includes('*') || permissions.includes(required)) return true;
  const domain = String(required || '').split('.', 1)[0];
  return Boolean(domain && permissions.includes(`${domain}.admin`));
}

export async function resolveExecutionContext({ request, supabaseUrl, publishableKey, fetchFn = fetch } = {}) {
  if (!request || !supabaseUrl || !publishableKey) throw new TypeError('auth_dependencies_required');
  const bearer = bearerOf(request);
  const headers = { apikey: publishableKey, authorization: bearer, 'content-type': 'application/json' };

  let userResponse;
  try {
    userResponse = await fetchFn(`${supabaseUrl}/auth/v1/user`, { headers, cache: 'no-store' });
  } catch {
    throw fail('identity_unavailable', 502);
  }
  if (!userResponse.ok) {
    if (userResponse.status === 401 || userResponse.status === 403) throw fail('unauthenticated', 401);
    throw fail('identity_unavailable', 502);
  }
  const user = await userResponse.json();
  if (!user?.id) throw fail('unauthenticated', 401);

  const requestedOrganization = (request.headers.get('x-atlas-org-id') || '').trim();
  if (requestedOrganization && !uuid(requestedOrganization)) throw fail('invalid_input', 400, { field: 'organization_id' });

  let membershipResponse;
  try {
    membershipResponse = await fetchFn(
      `${supabaseUrl}/rest/v1/organization_members?select=org_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active`,
      { headers, cache: 'no-store' }
    );
  } catch {
    throw fail('identity_unavailable', 502);
  }
  const memberships = await readJson(membershipResponse, 'identity_unavailable');
  if (!Array.isArray(memberships) || memberships.length === 0) throw fail('forbidden', 403);
  const membership = requestedOrganization
    ? memberships.find((row) => row.org_id === requestedOrganization)
    : memberships[0];
  if (!membership) throw fail('forbidden', 403);

  let permissionsResponse;
  try {
    permissionsResponse = await fetchFn(
      `${supabaseUrl}/rest/v1/identity_role_permissions?select=permission_code&role=eq.${encodeURIComponent(membership.role)}`,
      { headers, cache: 'no-store' }
    );
  } catch {
    throw fail('identity_unavailable', 502);
  }
  const rows = await readJson(permissionsResponse, 'identity_unavailable');
  const permissions = [...new Set((Array.isArray(rows) ? rows : []).map((row) => String(row.permission_code || '')).filter(Boolean))];

  return {
    context: {
      organization_id: membership.org_id,
      user_id: user.id,
      permissions,
      roles: [membership.role],
      request_id: crypto.randomUUID()
    },
    bearer
  };
}
