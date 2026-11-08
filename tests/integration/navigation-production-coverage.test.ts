import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES, ATLAS_NAV_ITEMS } from '../../apps/web/src/modules/registry';

type AcceptanceContract = {
  policy: string;
  verdicts: string[];
  required_dimensions: string[];
  navigation_route_holds: Array<{
    module_id: string;
    path: string;
    verdict: string;
    reason: string;
  }>;
};

type GlobalContract = {
  public_routes: string[];
  critical_network_routes?: string[];
  critical_crm_routes?: string[];
};

const acceptance = JSON.parse(
  readFileSync('data/ops/module-production-acceptance.json', 'utf8')
) as AcceptanceContract;

const globalContract = JSON.parse(
  readFileSync('data/ops/global-production-verification.json', 'utf8')
) as GlobalContract;

const verifiedRouteCoverage = new Set([
  ...globalContract.public_routes,
  ...(globalContract.critical_network_routes ?? []),
  ...(globalContract.critical_crm_routes ?? [])
]);

const canonicalNavRoutes = [...new Set(ATLAS_NAV_ITEMS.map((item) => item.to))];
const explicitHolds = new Set(
  acceptance.navigation_route_holds.map((hold) => hold.path)
);

describe('ATLAS navigation production coverage', () => {
  it('fails closed when canonical navigation drifts beyond production verification', () => {
    const uncovered = canonicalNavRoutes
      .filter((route) => !verifiedRouteCoverage.has(route))
      .sort();

    expect(uncovered).toEqual([...explicitHolds].sort());
  });

  it('requires every visible canonical module route to be verified or explicitly held', () => {
    const uncoveredVisibleModules = ATLAS_MODULES
      .filter((module) => module.showInNavigation)
      .filter(
        (module) =>
          !verifiedRouteCoverage.has(module.route) &&
          !explicitHolds.has(module.route)
      )
      .map((module) => ({ id: module.id, route: module.route }));

    expect(uncoveredVisibleModules).toEqual([]);
  });

  it('never leaves a now-covered route in verification hold', () => {
    const staleHolds = acceptance.navigation_route_holds
      .filter((hold) => verifiedRouteCoverage.has(hold.path))
      .map((hold) => hold.path);

    expect(staleHolds).toEqual([]);
  });

  it('keeps every exception explicit, evidence-oriented and non-green', () => {
    expect(acceptance.policy).toBe('fail-closed');

    for (const hold of acceptance.navigation_route_holds) {
      expect(hold.verdict).toBe('VERIFICATION_HOLD');
      expect(hold.reason.length).toBeGreaterThan(80);
      expect(
        acceptance.verdicts.includes(hold.verdict)
      ).toBe(true);
    }
  });

  it('defines the complete per-module production acceptance dimensions', () => {
    expect(acceptance.required_dimensions).toEqual([
      'canonical_navigation',
      'ux_flow',
      'responsive_desktop_tablet_mobile',
      'ui_states_loading_empty_error_success_unauthorized',
      'real_functionality_and_validation',
      'persistence_after_refresh',
      'tenant_scope_and_cross_tenant_denial',
      'server_side_rbac',
      'audit_and_secret_safety',
      'integration_handshake_and_fail_closed',
      'tests_build_deploy',
      'public_e2e_exact_sha'
    ]);
  });
});
