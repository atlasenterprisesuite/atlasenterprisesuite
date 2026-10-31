import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapAdvisoryFirm, createAdvisoryClient } from '../../apps/web/src/lib/advisoryApi';

const session = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(), authorizedAtlasFetch: vi.fn()
}));
vi.mock('../../apps/web/src/lib/atlasSession', () => session);

describe('Advisory bootstrap organization boundary', () => {
  const firm = { id: 'firm-A', org_id: 'org-A', status: 'active' };
  beforeEach(() => {
    vi.resetAllMocks();
    session.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-A' });
  });
  const respond = (rows: unknown) => session.authorizedAtlasFetch.mockResolvedValue({
    ok: true, text: async () => JSON.stringify(rows)
  });

  it('accepts one active firm bound to the selected organization', async () => {
    respond([firm]);
    await expect(bootstrapAdvisoryFirm()).resolves.toEqual(firm);
  });
  it.each([
    [{ ...firm, org_id: 'org-B' }],
    [{ ...firm, status: 'inactive' }],
    [{ ...firm, id: '' }],
    [firm, { ...firm, id: 'firm-B' }],
    []
  ].map(rows => ({ rows })))('denies invalid bootstrap rows before client creation: $rows', async ({ rows }) => {
    respond(rows);
    await expect(createAdvisoryClient({ displayName: 'Synthetic client' })).rejects.toThrow();
    expect(session.authorizedAtlasFetch).toHaveBeenCalledTimes(1);
    expect(session.authorizedAtlasFetch.mock.calls[0][0]).toBe('/rest/v1/rpc/advisory_bootstrap_default_firm');
  });
  it('denies a changed organization while bootstrap is in flight', async () => {
    session.getActiveAtlasOrganization.mockResolvedValueOnce({ id: 'org-A' }).mockResolvedValue({ id: 'org-B' });
    respond([firm]);
    await expect(createAdvisoryClient({ displayName: 'Synthetic client' })).rejects.toThrow();
    expect(session.authorizedAtlasFetch).toHaveBeenCalledTimes(1);
  });
});
