import { describe, expect, it } from 'vitest';
import { executeAtlasMaxDecision } from '../../apps/web/src/services/atlas-max/execution';
describe('ATLAS MAX governed execution', () => {
  it('denies cross-tenant execution', () => expect(executeAtlasMaxDecision({ tenantId:'a', actorTenantId:'b' }).status).toBe('denied'));
  it('does not claim completion without evidence', () => expect(executeAtlasMaxDecision({ tenantId:'a', actorTenantId:'a' }).status).not.toBe('completed'));
});