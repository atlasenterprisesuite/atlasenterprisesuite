import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../apps/web/src/lib/atlasSession';
import { getEnterpriseUsage } from '../../apps/web/src/work/api';

const authorizedFetch = vi.mocked(authorizedAtlasFetch);
const getOrg = vi.mocked(getActiveAtlasOrganization);
const report = {
  source: 'atlas_ai_usage',
  period: '2026-11',
  eventCount: 0,
  sampleIsComplete: true,
  recentEvents: [],
  creditLimitStatus: 'unconfigured',
  creditsRemaining: null,
  paidExecutionEnabled: false
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  getOrg.mockResolvedValue({ id: 'org-a', role: 'owner' });
  authorizedFetch.mockResolvedValue(respond({ ok: true, report }));
});
afterEach(() => vi.resetAllMocks());

describe('ATLAS Work Enterprise usage client trust boundary', () => {
  it('requests only the trusted org-scoped operation, never a client actor or credit limit', async () => {
    expect(await getEnterpriseUsage()).toMatchObject(report);
    expect(authorizedFetch).toHaveBeenCalledWith('/functions/v1/atlas-execution', {
      method: 'POST',
      body: JSON.stringify({ operation: 'get_enterprise_usage', organization_id: 'org-a' })
    });
  });

  it('rejects a forged credit balance or unauthorized paid mode', async () => {
    for (const altered of [
      { ...report, creditsRemaining: 100 },
      { ...report, paidExecutionEnabled: true },
      { ...report, creditLimitStatus: 'configured' },
      { ...report, eventCount: 2, sampleIsComplete: true, recentEvents: [] }
    ]) {
      authorizedFetch.mockResolvedValueOnce(respond({ ok: true, report: altered }));
      await expect(getEnterpriseUsage()).rejects.toThrow(/enterprise_usage_/);
    }
  });

  it('propagates authenticated server denial rather than rendering fabricated usage', async () => {
    authorizedFetch.mockResolvedValueOnce(respond({ ok: false, error: 'membership_required' }, 403));
    await expect(getEnterpriseUsage()).rejects.toThrow('membership_required');
  });
});
