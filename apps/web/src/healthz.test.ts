import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('deployment health artifact', () => {
  it('publishes a static health endpoint payload with no fabricated integration state', async () => {
    const raw = await readFile(new URL('../../../public/healthz.json', import.meta.url), 'utf8');
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
