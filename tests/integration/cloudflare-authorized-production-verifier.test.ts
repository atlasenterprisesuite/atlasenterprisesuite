import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'utf8'
);
const workflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('Cloudflare authorized production HTTP verifier', () => {
  it('accepts only scoped GitHub OIDC from the main Cloudflare deployment workflow', () => {
    expect(verifier).toContain("const AUDIENCE = 'atlas-production-http-verifier'");
    expect(verifier).toContain(".github/workflows/cloudflare-deploy.yml@refs/heads/main");
    expect(verifier).toContain("payload.repository !== REPO");
    expect(verifier).toContain("payload.ref !== 'refs/heads/main'");
  });

  it('checks the public shell while preserving the protected deployment path', () => {
    expect(verifier).toContain("'/identity?app=%2Ffinance'");
    expect(verifier).toContain("'/finance'");
    expect(verifier).toContain("'/deployment.json'");
    expect(verifier).toContain("[302, 401, 403].includes(deployment.status)");
    expect(verifier).toContain("verification_source: 'atlas-authorized-supabase-runtime'");
  });

  it('lets the workflow fall back to authorized runtime verification when GitHub is challenged', () => {
    expect(workflow).toContain('Verify production shell through authorized ATLAS runtime');
    expect(workflow).toContain('audience=atlas-production-http-verifier');
    expect(workflow).toContain('/functions/v1/atlas-cloudflare-production-http-verify?api=verify');
    expect(workflow).toContain('AUTHORIZED_EDGE_VERIFIED');
  });
});
