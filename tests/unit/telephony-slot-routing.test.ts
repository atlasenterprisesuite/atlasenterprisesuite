import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');

describe('telephony runtime routing', () => {
  it('uses the deployed runtime for readiness', () => {
    expect(source).toContain('/functions/v1/atlas-cloudflare-seed-build-once?api=readiness');
  });
  it('uses the deployed runtime for outbound calls', () => {
    expect(source).toContain('/functions/v1/atlas-cloudflare-seed-build-once?api=call');
  });
});
