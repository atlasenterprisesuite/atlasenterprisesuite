import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const evaluatorPath = 'scripts/lib/commercial-release.mjs';

const requiredRoutes = [
  '/',
  '/suite',
  '/pricing',
  '/request-demo',
  '/contact',
  '/terms',
  '/privacy',
  '/security',
  '/status'
];

function validInput() {
  const sha = 'a'.repeat(40);
  return {
    expected_sha: sha,
    offer_id: 'atlas-business',
    catalog_version: '2026.10.04-v1',
    global_production: {
      ok: true,
      expected_sha: sha,
      deployed_sha: sha,
      production_commit_sha_verified: true
    },
    public_surface: {
      routes: Object.fromEntries(requiredRoutes.map((route) => [route, true]))
    },
    enterprise: {
      tenant_isolation_verified: true,
      rbac_server_authoritative: true,
      audit_verified: true,
      privileged_auth_policy_verified: true,
      backup_restore_evidence_current: true,
      p0_security_findings: [] as string[]
    },
    revenue: {
      lead_entrypoint_verified: true,
      authoritative_lead_workflow: true,
      price_order_semantics_verified: true,
      provisioning_governed: true,
      browser_authoritative_state: false
    },
    legal: {
      terms_published: true,
      privacy_published: true,
      security_published: true,
      legal_review_verified: true,
      owner_verified: true
    },
    capabilities: [
      {
        module_id: 'business',
        required: true,
        catalog_state: 'SELLABLE',
        evidence_current: true,
        regulated: false,
        external_evidence_verified: false
      },
      {
        module_id: 'connect',
        required: false,
        catalog_state: 'EXTERNAL_GATED',
        evidence_current: false,
        regulated: true,
        external_evidence_verified: false
      }
    ]
  };
}

async function loadEvaluator() {
  return import('../../scripts/lib/commercial-release.mjs');
}

describe('ATLAS Commercial Release decision engine', () => {
  it('adds a pure commercial release evaluator before sellability can exist', () => {
    expect(existsSync(evaluatorPath)).toBe(true);
  });

  it('returns SELLABLE only for a complete P0 evidence set', async () => {
    if (!existsSync(evaluatorPath)) return;
    const { evaluateCommercialRelease } = await loadEvaluator();
    const result = evaluateCommercialRelease(validInput());

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('SELLABLE');
    expect(result.blockers).toEqual([]);
    expect(result.warnings.some((warning: { code: string }) => warning.code === 'optional_external_gated')).toBe(true);
  });

  const blockerCases: Array<{
    name: string;
    code: string;
    mutate: (input: ReturnType<typeof validInput>) => void;
  }> = [
    {
      name: 'wrong production SHA',
      code: 'production_sha_mismatch',
      mutate: (input) => { input.global_production.deployed_sha = 'b'.repeat(40); }
    },
    {
      name: 'global production not verified',
      code: 'global_production_unverified',
      mutate: (input) => { input.global_production.ok = false; }
    },
    {
      name: 'missing P0 public route',
      code: 'public_route_unverified',
      mutate: (input) => { input.public_surface.routes['/privacy'] = false; }
    },
    {
      name: 'missing legal review evidence',
      code: 'legal_review_unverified',
      mutate: (input) => { input.legal.legal_review_verified = false; }
    },
    {
      name: 'unresolved P0 security finding',
      code: 'p0_security_finding',
      mutate: (input) => { input.enterprise.p0_security_findings = ['tenant-policy-bypass']; }
    },
    {
      name: 'missing price and order semantics',
      code: 'commercial_terms_unverified',
      mutate: (input) => { input.revenue.price_order_semantics_verified = false; }
    },
    {
      name: 'browser-owned commercial authority',
      code: 'browser_authoritative_state',
      mutate: (input) => { input.revenue.browser_authoritative_state = true; }
    },
    {
      name: 'required capability not sellable',
      code: 'required_capability_not_sellable',
      mutate: (input) => { input.capabilities[0].catalog_state = 'PREVIEW'; }
    },
    {
      name: 'required capability evidence stale',
      code: 'required_capability_evidence_stale',
      mutate: (input) => { input.capabilities[0].evidence_current = false; }
    },
    {
      name: 'required regulated capability lacks external evidence',
      code: 'regulated_capability_unverified',
      mutate: (input) => {
        input.capabilities[0].regulated = true;
        input.capabilities[0].external_evidence_verified = false;
      }
    },
    {
      name: 'required capability has no catalog state',
      code: 'required_capability_state_missing',
      mutate: (input) => { input.capabilities[0].catalog_state = '' as never; }
    }
  ];

  for (const blockerCase of blockerCases) {
    it(`blocks ${blockerCase.name}`, async () => {
      if (!existsSync(evaluatorPath)) return;
      const { evaluateCommercialRelease } = await loadEvaluator();
      const input = validInput();
      blockerCase.mutate(input);
      const result = evaluateCommercialRelease(input);

      expect(result.ok).toBe(false);
      expect(result.outcome).toBe('BLOCKED');
      expect(result.blockers.some((blocker: { code: string }) => blocker.code === blockerCase.code)).toBe(true);
    });
  }

  it('does not let warning-only diagnostics convert BLOCKED into SELLABLE', async () => {
    if (!existsSync(evaluatorPath)) return;
    const { evaluateCommercialRelease } = await loadEvaluator();
    const input = validInput();
    input.legal.legal_review_verified = false;

    const result = evaluateCommercialRelease(input, { mode: 'warning-only' });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.ok).toBe(false);
  });
});
