import { describe, expect, it } from 'vitest';
import { resolveAtlasModuleForPath } from '../../apps/web/src/access/moduleAccess';

describe('ATLAS module access routing', () => {
  it('resolves the most specific canonical module for nested routes', () => {
    expect(resolveAtlasModuleForPath('/finance/accounting/accounts-payable')?.id).toBe('accounting');
    expect(resolveAtlasModuleForPath('/studio/create?type=video')?.id).toBe('studio');
    expect(resolveAtlasModuleForPath('/crm/contacts')?.id).toBe('crm');
  });

  it('does not invent a module for unrelated routes', () => {
    expect(resolveAtlasModuleForPath('/identity')).toBeNull();
    expect(resolveAtlasModuleForPath('/unknown')).toBeNull();
  });
});
