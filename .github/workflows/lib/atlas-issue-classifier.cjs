'use strict';

// Conservative inference: only explicit, auditable signals; never infer permission.
function readField(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(body || '').match(new RegExp('^### ' + escaped + '\\s*\\n+([\\s\\S]*?)(?=\\n### |\\n## |$)', 'im'));
  return match ? match[1].replace(/<!--.*?-->/gs, '').trim() : '';
}
function classify(issue) {
  const body = String(issue.body || '');
  const title = String(issue.title || '');
  const source = title + '\n' + body;
  const module = readField(body, 'Owner module') ||
    (/ATLAS Universal Intelligence(?: 777)?/i.test(source) ? 'ATLAS Universal Intelligence 777' : '');
  const type = readField(body, 'Issue type') ||
    (/\b(?:MVP|feature|implement|implementation)\b/i.test(source) ? 'Feature' :
      /\b(?:bug|regression|broken|failure)\b/i.test(source) ? 'Bug' : '');
  const explicitPriority = readField(body, 'Priority').match(/\bP[0-4]\b/i);
  const priority = explicitPriority ? explicitPriority[0].toUpperCase() :
    (/\bP0\b/i.test(source) ? 'P0' : '');
  const tenant = readField(body, 'Tenant-sensitive?');
  const security = readField(body, 'Security-sensitive?');
  const production = readField(body, 'Production mutation or deployment required?');
  const risky = /\b(?:P0|RBAC|RLS|multi-tenant|tenant.scop|auth(?:entication|orization)?|security|audit|deploy(?:ment)?|production|secret|permission)\b/i.test(source);
  const sensitive = priority === 'P0' || risky || /^yes$/i.test(tenant) ||
    /^yes$/i.test(security) || /^yes$/i.test(production);
  const complete = Boolean(module && type && priority);
  const structured = Boolean(readField(body, 'Owner module') &&
    readField(body, 'Issue type') && explicitPriority);
  // Inferred metadata is provisional; it never grants automatic execution.
  const autoEligible = structured && complete && !sensitive &&
    /^no$/i.test(tenant) && /^no$/i.test(security) && /^no$/i.test(production);
  return { module, type, priority, structured, complete, sensitive, autoEligible,
    inferred: !structured, tenant, security, production };
}
module.exports = { classify, readField };
