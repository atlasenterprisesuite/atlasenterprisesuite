const REQUIRED_PUBLIC_ROUTES = Object.freeze([
  '/',
  '/suite',
  '/pricing',
  '/request-demo',
  '/contact',
  '/terms',
  '/privacy',
  '/security',
  '/status'
]);

const VALID_CAPABILITY_STATES = new Set([
  'SELLABLE',
  'PREVIEW',
  'EXTERNAL_GATED',
  'INTERNAL_ONLY',
  'NOT_FOR_SALE'
]);

function finding(code, message, metadata = undefined) {
  return metadata === undefined ? { code, message } : { code, message, metadata };
}

function isTrue(value) {
  return value === true;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function evaluateGlobalProduction(input, blockers) {
  const global = input?.global_production ?? {};
  if (!isTrue(global.ok) || !isTrue(global.production_commit_sha_verified)) {
    blockers.push(finding('global_production_unverified', 'Global production verification is not green for this release.'));
  }

  const expected = String(input?.expected_sha ?? '');
  const globalExpected = String(global.expected_sha ?? '');
  const deployed = String(global.deployed_sha ?? '');
  if (!expected || globalExpected !== expected || deployed !== expected) {
    blockers.push(finding('production_sha_mismatch', 'Commercial evidence is not bound to the exact production SHA.', {
      expected_sha: expected || null,
      global_expected_sha: globalExpected || null,
      deployed_sha: deployed || null
    }));
  }
}

function evaluatePublicSurface(input, blockers) {
  const routes = input?.public_surface?.routes ?? {};
  for (const route of REQUIRED_PUBLIC_ROUTES) {
    if (!isTrue(routes[route])) {
      blockers.push(finding('public_route_unverified', `Required public commercial route is not verified: ${route}`, { route }));
    }
  }
}

function evaluateEnterprise(input, blockers) {
  const enterprise = input?.enterprise ?? {};
  const requiredChecks = [
    ['tenant_isolation_verified', 'tenant_isolation_unverified', 'Tenant isolation is not verified.'],
    ['rbac_server_authoritative', 'rbac_unverified', 'Server-authoritative RBAC is not verified.'],
    ['audit_verified', 'audit_unverified', 'Privileged commercial audit evidence is not verified.'],
    ['privileged_auth_policy_verified', 'privileged_auth_unverified', 'Privileged authentication policy is not verified.'],
    ['backup_restore_evidence_current', 'backup_restore_evidence_stale', 'Backup/restore evidence is missing or stale.']
  ];

  for (const [field, code, message] of requiredChecks) {
    if (!isTrue(enterprise[field])) blockers.push(finding(code, message));
  }

  if (nonEmptyArray(enterprise.p0_security_findings)) {
    blockers.push(finding('p0_security_finding', 'One or more unresolved P0 security findings block commercial release.', {
      findings: [...enterprise.p0_security_findings]
    }));
  }
}

function evaluateRevenue(input, blockers) {
  const revenue = input?.revenue ?? {};
  const requiredChecks = [
    ['lead_entrypoint_verified', 'lead_entrypoint_unverified', 'Public lead/demo entrypoint is not verified.'],
    ['authoritative_lead_workflow', 'lead_workflow_unverified', 'Lead routing is not authoritative.'],
    ['price_order_semantics_verified', 'commercial_terms_unverified', 'Price/order semantics are not verified.'],
    ['provisioning_governed', 'provisioning_ungoverned', 'Provisioning authorization is not governed.']
  ];

  for (const [field, code, message] of requiredChecks) {
    if (!isTrue(revenue[field])) blockers.push(finding(code, message));
  }

  if (isTrue(revenue.browser_authoritative_state)) {
    blockers.push(finding('browser_authoritative_state', 'Browser state cannot assert contractual, billing, or provisioning authority.'));
  }
}

function evaluateLegal(input, blockers) {
  const legal = input?.legal ?? {};
  const publicationChecks = [
    ['terms_published', 'terms_unpublished', 'Terms are not published.'],
    ['privacy_published', 'privacy_unpublished', 'Privacy policy is not published.'],
    ['security_published', 'security_unpublished', 'Security/trust surface is not published.'],
    ['owner_verified', 'legal_owner_unverified', 'Legal document ownership is not verified.']
  ];

  for (const [field, code, message] of publicationChecks) {
    if (!isTrue(legal[field])) blockers.push(finding(code, message));
  }

  if (!isTrue(legal.legal_review_verified)) {
    blockers.push(finding('legal_review_unverified', 'Required legal-review evidence is absent.'));
  }
}

function evaluateCapabilities(input, blockers, warnings) {
  const capabilities = Array.isArray(input?.capabilities) ? input.capabilities : [];
  const evaluated = [];

  for (const capability of capabilities) {
    const moduleId = String(capability?.module_id ?? '').trim() || 'unknown';
    const required = capability?.required === true;
    const state = String(capability?.catalog_state ?? '');
    const evidenceCurrent = capability?.evidence_current === true;
    const regulated = capability?.regulated === true;
    const externalVerified = capability?.external_evidence_verified === true;

    const capabilityBlockers = [];
    const capabilityWarnings = [];

    if (required && !VALID_CAPABILITY_STATES.has(state)) {
      capabilityBlockers.push('required_capability_state_missing');
      blockers.push(finding('required_capability_state_missing', `Required capability has no valid commercial state: ${moduleId}`, { module_id: moduleId }));
    } else if (required && state !== 'SELLABLE') {
      capabilityBlockers.push('required_capability_not_sellable');
      blockers.push(finding('required_capability_not_sellable', `Required capability is not SELLABLE: ${moduleId}`, {
        module_id: moduleId,
        state: state || null
      }));
    }

    if (required && !evidenceCurrent) {
      capabilityBlockers.push('required_capability_evidence_stale');
      blockers.push(finding('required_capability_evidence_stale', `Required capability evidence is missing or stale: ${moduleId}`, { module_id: moduleId }));
    }

    if (required && regulated && !externalVerified) {
      capabilityBlockers.push('regulated_capability_unverified');
      blockers.push(finding('regulated_capability_unverified', `Required regulated/provider-gated capability lacks external evidence: ${moduleId}`, { module_id: moduleId }));
    }

    if (!required && (state === 'PREVIEW' || state === 'EXTERNAL_GATED' || state === 'INTERNAL_ONLY' || state === 'NOT_FOR_SALE')) {
      const code = state === 'EXTERNAL_GATED' ? 'optional_external_gated' : 'optional_capability_not_sellable';
      capabilityWarnings.push(code);
      warnings.push(finding(code, `Optional capability is not part of the sellable commitment: ${moduleId}`, {
        module_id: moduleId,
        state
      }));
    }

    evaluated.push({
      module_id: moduleId,
      required,
      catalog_state: state || null,
      evidence_current: evidenceCurrent,
      regulated,
      external_evidence_verified: externalVerified,
      blockers: capabilityBlockers,
      warnings: capabilityWarnings
    });
  }

  return evaluated;
}

export function evaluateCommercialRelease(input, options = {}) {
  const blockers = [];
  const warnings = [];

  evaluateGlobalProduction(input, blockers);
  evaluatePublicSurface(input, blockers);
  evaluateEnterprise(input, blockers);
  evaluateRevenue(input, blockers);
  evaluateLegal(input, blockers);
  const capabilities = evaluateCapabilities(input, blockers, warnings);

  const outcome = blockers.length === 0 ? 'SELLABLE' : 'BLOCKED';
  return {
    ok: outcome === 'SELLABLE',
    outcome,
    mode: options?.mode === 'warning-only' ? 'warning-only' : 'fail-closed',
    offer_id: input?.offer_id ?? null,
    catalog_version: input?.catalog_version ?? null,
    evaluated_sha: input?.expected_sha ?? null,
    blockers,
    warnings,
    capabilities,
    checks: {
      required_public_routes: [...REQUIRED_PUBLIC_ROUTES],
      global_production: blockers.every((entry) => !['global_production_unverified', 'production_sha_mismatch'].includes(entry.code)),
      public_surface: blockers.every((entry) => entry.code !== 'public_route_unverified'),
      enterprise: blockers.every((entry) => ![
        'tenant_isolation_unverified',
        'rbac_unverified',
        'audit_unverified',
        'privileged_auth_unverified',
        'backup_restore_evidence_stale',
        'p0_security_finding'
      ].includes(entry.code)),
      revenue: blockers.every((entry) => ![
        'lead_entrypoint_unverified',
        'lead_workflow_unverified',
        'commercial_terms_unverified',
        'provisioning_ungoverned',
        'browser_authoritative_state'
      ].includes(entry.code)),
      legal: blockers.every((entry) => ![
        'terms_unpublished',
        'privacy_unpublished',
        'security_unpublished',
        'legal_owner_unverified',
        'legal_review_unverified'
      ].includes(entry.code))
    }
  };
}

export { REQUIRED_PUBLIC_ROUTES };
