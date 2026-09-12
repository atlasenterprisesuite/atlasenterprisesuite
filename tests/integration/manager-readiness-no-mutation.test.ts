import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-execution/manager-readiness.ts', 'utf8');

describe('Manager readiness provider safety', () => {
  it('uses the existing status boundary and introduces no provider mutation surface', () => {
    expect(source).toContain("method: 'GET'");
    expect(source).toContain('/functions/v1/atlas-infra-status');
    for (const forbidden of [
      'ec2.amazonaws.com', 'RunInstances', 'TerminateInstances',
      'api.cloudflare.com/client/v4', 'dns_records',
      'api.github.com/repos', '/git/refs', '/deployments',
      'api.vercel.com', 'CLOUDFLARE_API_TOKEN', 'GITHUB_TOKEN', 'VERCEL_TOKEN',
      'production-deploy', 'repair-bridge?api=execute'
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
