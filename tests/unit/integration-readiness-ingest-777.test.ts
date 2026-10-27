import { describe, expect, it, vi } from 'vitest';
import { ingestIntegrationReadiness } from '../../packages/core/src/integrationReadinessIngest777';
import type { ReadinessResult } from '../../packages/core/src/integrationReadiness777';
const sha = 'a'.repeat(40);
const record = { repository: 'atlasenterprisesuite/atlasenterprisesuite', moduleId: 'atlas-pay', sha, p0Open: true, authorizationRequired: true, authorized: false, organizationId: 'org-a' };
function fixture() {
  const inventory = { loadForOrganization: vi.fn(async () => record) };
  const github = {
    fetchRuns: vi.fn(async () => [{ id: 42, name: 'ATLAS Build + Production Readiness Gate', head_sha: sha, status: 'completed', conclusion: 'success' }]),
    verifyStepInJobLogs: vi.fn(async () => true)
  };
  const ledger = { load: vi.fn(async (): Promise<ReadinessResult | null> => null), appendIfAbsent: vi.fn(async () => true), save: vi.fn(async () => {}) };
  return { inventory, github, ledger };
}
const args = { organizationId: 'org-a', moduleId: 'atlas-pay', now: '2026-10-26T15:00:00Z' };
describe('Trusted GitHub integration readiness ingestion', () => {
  it('denies cross-tenant inventory even if returned by storage', async () => {
    const f = fixture();
    const result = await ingestIntegrationReadiness({ ...args, organizationId: 'org-b', ...f });
    expect(result.status).toBe('blocked');
    expect(f.github.fetchRuns).not.toHaveBeenCalled();
  });
  it('rejects malformed SHA before any GitHub request', async () => {
    const f = fixture();
    f.inventory.loadForOrganization.mockResolvedValue({ ...record, sha: 'main' });
    expect((await ingestIntegrationReadiness({ ...args, ...f })).status).toBe('blocked');
    expect(f.github.fetchRuns).not.toHaveBeenCalled();
  });
  it('fails closed when verified logs are unavailable', async () => {
    const f = fixture();
    f.github.verifyStepInJobLogs.mockResolvedValue(false);
    const result = await ingestIntegrationReadiness({ ...args, ...f });
    expect(result.status).toBe('recorded');
    if (result.status === 'recorded') expect(result.current.verifiedChecks).toEqual([]);
    // Missing CI logs must never produce a certification milestone, but an
    // authorization blocker remains auditable even when no checks are verified.
    expect(f.ledger.appendIfAbsent).toHaveBeenCalledTimes(1);
    expect(f.ledger.appendIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'authorization_blocker', sha, moduleId: 'atlas-pay',
      blockers: expect.arrayContaining(['AUTHORIZATION_REQUIRED', 'P0_OPEN'])
    }));
  });
  it('does not certify an integration while P0 is open', async () => {
    const f = fixture();
    const result = await ingestIntegrationReadiness({ ...args, ...f });
    expect(result.status).toBe('recorded');
    if (result.status === 'recorded') expect(result.current.blockers).toContain('P0_OPEN');
  });
  it('rejects runs from a different SHA without granting verified checks', async () => {
    const f = fixture();
    f.github.fetchRuns.mockResolvedValue([{ id: 42, name: 'ATLAS Build + Production Readiness Gate', head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success' }]);
    const result = await ingestIntegrationReadiness({ ...args, ...f });
    expect(result.status).toBe('recorded');
    if (result.status === 'recorded') expect(result.current.verifiedChecks).toEqual([]);
    expect(f.github.verifyStepInJobLogs).not.toHaveBeenCalled();
  });
  it('fails closed when inventory storage is unavailable', async () => {
    const f = fixture();
    f.inventory.loadForOrganization.mockRejectedValue(new Error('database offline'));
    expect((await ingestIntegrationReadiness({ ...args, ...f })).status).toBe('blocked');
    expect(f.github.fetchRuns).not.toHaveBeenCalled();
    expect(f.ledger.save).not.toHaveBeenCalled();
  });
  it('does not persist readiness when audit append is unconfirmed', async () => {
    const f = fixture();
    f.ledger.appendIfAbsent.mockResolvedValue(false);
    const result = await ingestIntegrationReadiness({ ...args, ...f });
    expect(result.status).toBe('blocked');
    expect(f.ledger.save).not.toHaveBeenCalled();
  });
  it('does not claim a recorded result when durable save fails', async () => {
    const f = fixture();
    f.ledger.save.mockRejectedValue(new Error('storage unavailable'));
    const result = await ingestIntegrationReadiness({ ...args, ...f });
    expect(result.status).toBe('blocked');
    expect(f.ledger.appendIfAbsent).toHaveBeenCalledTimes(1);
  });
  it('does not append a duplicate authorization event for an unchanged snapshot', async () => {
    const f = fixture();
    const first = await ingestIntegrationReadiness({ ...args, ...f });
    expect(first.status).toBe('recorded');
    if (first.status !== 'recorded') return;
    f.ledger.load.mockResolvedValue(first.current);
    const second = await ingestIntegrationReadiness({ ...args, ...f });
    expect(second.status).toBe('recorded');
    expect(f.ledger.appendIfAbsent).toHaveBeenCalledTimes(1);
  });
  it('blocks when trusted GitHub source throws', async () => {
    const f = fixture();
    f.github.fetchRuns.mockRejectedValue(new Error('unavailable'));
    expect((await ingestIntegrationReadiness({ ...args, ...f })).status).toBe('blocked');
    expect(f.ledger.save).not.toHaveBeenCalled();
  });
});
