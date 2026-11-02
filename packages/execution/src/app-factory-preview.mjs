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
