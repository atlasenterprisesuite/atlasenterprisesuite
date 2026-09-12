import { describe, expect, it } from 'vitest';
import { hasPermission, permissionDomain } from '../../packages/core/src/index';

describe('universal ATLAS permissions', () => {
  it('allows exact permission', () => {
    expect(hasPermission(['workflow.read'], 'workflow.read')).toBe(true);
  });

  it('allows a same-domain admin permission', () => {
    expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
  });

  it('does not let accounting admin approve workflows', () => {
    expect(hasPermission(['accounting.admin'], 'workflow.approve')).toBe(false);
  });

  it('extracts the permission domain', () => {
    expect(permissionDomain('pay.card.manage')).toBe('pay');
  });
});
