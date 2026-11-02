/**
 * ATLAS App Factory — deterministic, non-executing idea -> plan -> preview.
 * This is a proposal artifact, not an application deployment or authorization grant.
 */
const MAX_IDEA = 2000;
const MAX_NAME = 80;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const clean = (value) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

export function createAppFactoryPreview({ idea, organizationId, actorId, name } = {}) {
  if (typeof organizationId !== 'string' || !SAFE_ID.test(organizationId)) {
    throw new TypeError('organization_scope_required');
  }
  if (typeof actorId !== 'string' || !SAFE_ID.test(actorId)) {
    throw new TypeError('authenticated_actor_required');
  }
  if (typeof idea !== 'string' || !idea.trim() || idea.length > MAX_IDEA) {
    throw new TypeError('invalid_idea');
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME)) {
    throw new TypeError('invalid_name');
  }
  const normalizedIdea = clean(idea);
  const title = name === undefined ? 'New ATLAS application' : clean(name);
  const plan = {
    version: 1,
    organizationId,
    actorId,
    title,
    summary: normalizedIdea,
    status: 'proposal',
    steps: [
      { id: 'requirements', label: 'Review requirements', status: 'pending' },
      { id: 'design', label: 'Review accessible UI and data boundaries', status: 'pending' },
      { id: 'implementation', label: 'Implement in isolated branch', status: 'pending' },
      { id: 'verification', label: 'Run tenant and security tests', status: 'pending' }
    ],
    approvalRequired: true,
    executable: false,
    deployable: false
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(normalizedIdea)}</p><p role="status">Concept preview only — not deployed</p></main></body></html>`;
  return { plan, preview: { kind: 'static-html', html, scriptsAllowed: false, networkAllowed: false } };
}

/**
 * Authenticated integration boundary. Caller identity MUST originate from a
 * verified server session; authorization callback MUST query the authoritative
 * membership/permission store, never user-submitted claims.
 *
 * The second check prevents publishing a preview after a revocation observed
 * while the preview is being prepared. This is not a transactional guarantee:
 * persistence and execution require database-side authorization at commit time.
 */
export async function createAuthorizedAppFactoryPreview(input, { session, authorize } = {}) {
  if (!session || typeof session.actorId !== 'string' || !SAFE_ID.test(session.actorId)) {
    throw new Error('app_factory_unauthenticated');
  }
  if (!input || typeof input !== 'object' || typeof authorize !== 'function') {
    throw new Error('app_factory_authorization_unavailable');
  }
  const organizationId = input.organizationId;
  if (typeof organizationId !== 'string' || !SAFE_ID.test(organizationId)) {
    throw new Error('app_factory_organization_invalid');
  }
  const check = async () => {
    try {
      const decision = await authorize({ actorId: session.actorId, organizationId, permission: 'app_factory.preview' });
      if (decision !== true) throw new Error('denied');
    } catch {
      throw new Error('app_factory_forbidden');
    }
  };
  await check();
  const result = createAppFactoryPreview({ ...input, actorId: session.actorId, organizationId });
  await check();
  return {
    ...result,
    preview: {
      ...result.preview,
      // Consumer MUST render as iframe srcDoc, never dangerouslySetInnerHTML.
      sandbox: '',
      referrerPolicy: 'no-referrer',
      csp: "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; style-src 'none'; form-action 'none'; base-uri 'none'",
      integrationStatus: 'not-mounted'
    }
  };
}
