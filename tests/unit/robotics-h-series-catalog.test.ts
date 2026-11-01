import { describe, expect, it, vi } from 'vitest';
import type { ExecutionActor } from '../../packages/execution/src/types';
import { H_SERIES_VARIANTS, readHSeriesCatalog } from '../../packages/robotics/h-series-catalog';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const actor: ExecutionActor = { userId: 'user-a', scope, permissions: ['execution.read'] };
const authorize = vi.fn(async () => true);
describe('H-Series catalog F9: tenant isolation and fail-closed access', () => {
  it('F9-001 returns the five recovered variants with provenance', async () => {
    const result = await readHSeriesCatalog(actor, scope, authorize);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.variants.map(v => v.code)).toEqual(['H-B1','H-H1','H-O1','H-I1','H-D1']);
  });
  it('F9-002 blocks cross-tenant reads before callback', async () => {
    const check = vi.fn(async () => true);
    expect((await readHSeriesCatalog(actor, { ...scope, tenantId: 'tenant-b' }, check)).ok).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });
  it('F9-003 blocks cross-organization reads', async () => {
    expect((await readHSeriesCatalog(actor, { ...scope, organizationId: 'org-b' }, authorize)).ok).toBe(false);
  });
  it('F9-004 blocks missing read permission', async () => {
    expect((await readHSeriesCatalog({ ...actor, permissions: [] }, scope, authorize)).ok).toBe(false);
  });
  it('F9-005 blocks server authorization denial', async () => {
    expect((await readHSeriesCatalog(actor, scope, async () => false)).ok).toBe(false);
  });
  it('F9-006 fails closed on authorization outage', async () => {
    const result = await readHSeriesCatalog(actor, scope, async () => { throw Error('offline'); });
    expect(result).toEqual({ ok: false, reason: 'authorization_unavailable' });
  });
  it('F9-007 rejects empty tenant scope', async () => {
    expect((await readHSeriesCatalog(actor, { ...scope, tenantId: '' }, authorize)).ok).toBe(false);
  });
  it('F9-008 catalog contains no physical control interfaces', () => {
    expect(H_SERIES_VARIANTS.every(v => !('deviceId' in v) && !('actuate' in v))).toBe(true);
  });
});
