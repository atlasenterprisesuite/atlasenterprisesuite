import { describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../apps/web/src/lib/atlasSession';
import { getEnterpriseCreditStatus } from '../../apps/web/src/work/api';

const fetchMock = vi.mocked(authorizedAtlasFetch);
const orgMock = vi.mocked(getActiveAtlasOrganization);
const source = 'atlas_enterprise_credit_accounts';
const none = {
  source, status: 'not_installed', period: '2026-11', limitCredits: null,
  reservedCredits: null, spentCredits: null, availableCredits: null,
  paidExecutionEnabled: false
};
function response(credit: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status === 200, credit, error: status === 200 ? undefined : 'membership_required' }), { status });
}

describe('ATLAS Enterprise read-only credit status client', () => {
  it('requests credit state without actor, arbitrary organization or spend input', async () => {
    orgMock.mockResolvedValue({ id: 'org-a', role: 'owner' });
    fetchMock.mockResolvedValue(response(none));
    expect(await getEnterpriseCreditStatus()).toMatchObject(none);
    expect(fetchMock).toHaveBeenCalledWith('/functions/v1/atlas-execution', {
      method: 'POST',
      body: JSON.stringify({ operation: 'get_enterprise_credit_status', organization_id: 'org-a' })
    });
  });

  it('rejects forged paid authorization and invalid balance arithmetic', async () => {
    orgMock.mockResolvedValue({ id: 'org-a', role: 'owner' });
    for (const credit of [
      { ...none, paidExecutionEnabled: true },
      { ...none, status: 'allocated', limitCredits: 10, reservedCredits: 4, spentCredits: 7, availableCredits: -1 },
      { ...none, status: 'allocated', limitCredits: 10, reservedCredits: 2, spentCredits: 3, availableCredits: 9 },
      { ...none, status: 'not_installed', availableCredits: 123 }
    ]) {
      fetchMock.mockResolvedValueOnce(response(credit));
      await expect(getEnterpriseCreditStatus()).rejects.toThrow(/enterprise_credit_/);
    }
  });

  it('does not invent a credit limit when membership is denied', async () => {
    orgMock.mockResolvedValue({ id: 'org-a', role: 'owner' });
    fetchMock.mockResolvedValue(response(null, 403));
    await expect(getEnterpriseCreditStatus()).rejects.toThrow('membership_required');
  });
});
