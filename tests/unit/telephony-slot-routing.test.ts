import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');
const example = readFileSync('apps/web/.env.example', 'utf8');
const cloudflare = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('ATLAS telephony endpoint selection', () => {
  it('defaults to the reproducible canonical handler and supports the verified production alias', () => {
    expect(source).toContain('import.meta.env.VITE_ATLAS_TELEPHONY_FUNCTION_SLUG');
    expect(source).toContain("|| 'atlas-communication-telephony'");
    expect(source).toContain("TELEPHONY_FUNCTION_SLUG !== 'atlas-cloudflare-seed-build-once'");
    expect(source).toContain("throw new Error('telephony_endpoint_not_allowed')");
    expect(source).toContain("telephonyEndpoint('readiness')");
    expect(source).toContain("telephonyEndpoint('call')");
    expect(source).not.toContain("telephonyFetch('/functions/v1/atlas-cloudflare-seed-build-once");
  });

  it('documents preview defaults and pins the production Cloudflare build mapping', () => {
    expect(example).toContain('VITE_ATLAS_TELEPHONY_FUNCTION_SLUG=atlas-communication-telephony');
    expect(cloudflare).toContain('VITE_ATLAS_TELEPHONY_FUNCTION_SLUG: atlas-cloudflare-seed-build-once');
  });
});
