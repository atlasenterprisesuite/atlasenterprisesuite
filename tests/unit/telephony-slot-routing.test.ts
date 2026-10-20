import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');

describe('ATLAS telephony reused Supabase slot routing', () => {
  it('routes readiness and outbound calls through the reused telephony runtime slot', () => {
    expect(source).toContain('/functions/v1/atlas-cloudflare-seed-build-once?api=readiness');
    expect(source).toContain('/functions/v1/atlas-cloudflare-seed-build-once?api=call');
    expect(source).not.toContain('/functions/v1/atlas-communication-telephony?api=');
  });
});
