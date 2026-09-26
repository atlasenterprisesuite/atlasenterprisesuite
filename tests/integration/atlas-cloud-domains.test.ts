import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('ATLAS Cloud Domain & DNS Manager', () => {
  it('keeps DNS mutations fail-closed and exposes the governed verification route', () => {
    const ui = readFileSync('apps/web/src/modules/cloud/AtlasCloudDomains.tsx', 'utf8');
    const routes = readFileSync('apps/web/src/modules/cloud/AtlasCloudRoutes.tsx', 'utf8');
    const edge = readFileSync('supabase/functions/atlas-observability/index.ts', 'utf8');

    expect(ui).toContain('cloud-domain-verify');
    expect(ui).toContain('blocked_without_authorized_adapter');
    expect(routes).toContain('/cloud/domains');
    expect(edge).toContain("api==='cloud-domain-verify'");
    expect(edge).toContain('verifyDnsTxt');
    expect(edge).not.toContain('cloud-domain-mutate');
  });
});
