import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');
const example = readFileSync('apps/web/.env.example', 'utf8');

describe('ATLAS telephony endpoint selection', () => {
  it('selects the deployed JWT-protected slot in production without depending on external build variables', () => {
    expect(source).toContain('import.meta.env.VITE_ATLAS_TELEPHONY_FUNCTION_SLUG');
    expect(source).toContain('import.meta.env.PROD');
    expect(source).toContain("? 'atlas-cloudflare-seed-build-once'");
    expect(source).toContain(": 'atlas-communication-telephony'");
    expect(source).toContain("TELEPHONY_FUNCTION_SLUG !== 'atlas-cloudflare-seed-build-once'");
    expect(source).toContain("throw new Error('telephony_endpoint_not_allowed')");
    expect(source).toContain("telephonyEndpoint('readiness')");
    expect(source).toContain("telephonyEndpoint('call')");
    expect(source).not.toContain("telephonyFetch('/functions/v1/atlas-cloudflare-seed-build-once");
  });

  it('documents the optional preview override without making it a production requirement', () => {
    expect(example).toContain('# VITE_ATLAS_TELEPHONY_FUNCTION_SLUG=atlas-communication-telephony');
  });
});
