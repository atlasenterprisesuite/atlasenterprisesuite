import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deployment health artifact', () => {
  it('publishes a static health endpoint payload with no fabricated integration state', async () => {
    const raw = await readFile(join(process.cwd(), 'public', 'healthz.json'), 'utf8');
    const payload = JSON.parse(raw) as Record<string, unknown>;

    expect(payload).toEqual({
      status: 'ok',
      service: 'atlas-enterprise-suite',
      module: 'atlas-health',
      mode: 'static-build',
      liveClinicalIntegrations: false
    });
  });
});
