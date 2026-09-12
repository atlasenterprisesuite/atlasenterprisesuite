import { describe, expect, it } from 'vitest';
import { authorize, hasPermission } from '../../packages/core/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

describe('ATLAS shared authorization', () => {
  it('preserves accounting admin behavior', () => {
    expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
  });

  it('does not let accounting admin grant another namespace', () => {
    expect(hasPermission(['accounting.admin'], 'voice.personal.use')).toBe(false);
  });

  it('grants explicit granular voice permission', () => {
    expect(hasPermission(['voice.personal.record'], 'voice.personal.record')).toBe(true);
  });

  it('rejects organization mismatch before permission evaluation', () => {
    expect(authorize({ scope, permissions: ['integrations.admin'] }, {
      scope: { tenantId: 'tenant-a', organizationId: 'org-b' },
      permission: 'integrations.write'
    })).toEqual({ ok: false, reason: 'scope_mismatch' });
  });
});
