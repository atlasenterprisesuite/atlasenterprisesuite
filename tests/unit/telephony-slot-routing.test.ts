import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');

describe('ATLAS telephony deployed slot routing', () => {
  it('routes readiness and call requests to the authenticated reused runtime', () => {
    expect(source).toContain('/functions/v1/atlas-cloudflare-seed-build-once?api=readiness');
    expect(source).toContain('/functions/v1/atlas-cloudflare-seed-build-once?api=call');
    expect(source).not.toContain('/functions/v1/atlas-communication-telephony?api=');
  });

  it('retains organization-scoped authorized requests', () => {
    expect(source).toContain('authorizedAtlasFetch(path,');
    expect(source).toContain("'x-atlas-org-id': organization.id");
  });
});
