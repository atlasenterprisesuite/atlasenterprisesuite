import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = JSON.parse(
  readFileSync('data/ops/global-production-verification.json', 'utf8')
) as { public_routes: string[] };

const acceptance = JSON.parse(
  readFileSync('data/ops/module-production-acceptance.json', 'utf8')
) as { navigation_route_holds: Array<{ path: string }> };

const verifier = readFileSync(
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'utf8'
);

describe('Care and Digital City production route coverage', () => {
  for (const route of ['/care', '/city']) {
    it(`covers ${route} in direct and authorized fail-closed production verification`, () => {
      expect(contract.public_routes).toContain(route);
      expect(verifier).toContain(`'${route}'`);
      expect(
        acceptance.navigation_route_holds.some((hold) => hold.path === route)
      ).toBe(false);
    });
  }

  it('keeps module-level truth separate from route reachability', () => {
    expect(verifier).toContain('all_module_routes_reachable');
    expect(verifier).toContain('production_commit_sha_verified');
  });
});
