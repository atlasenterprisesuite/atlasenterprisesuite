import { describe, expect, it } from 'vitest';
import { assertAdvisoryScope } from '../../packages/advisory/src';

describe('AW Finance Cycle 02: negative tenant scope tests', () => {
  const resource = { organizationId: 'org-A', firmId: 'firm-A' };

  it('denies a cross-organization resource even with the same firm identifier', () => {
    expect(assertAdvisoryScope({ organizationId: 'org-B', firmId: 'firm-A' }, resource))
      .toEqual({ ok: false, reason: 'organization_mismatch' });
  });

  it('denies a cross-firm resource within the same organization', () => {
    expect(assertAdvisoryScope({ organizationId: 'org-A', firmId: 'firm-B' }, resource))
      .toEqual({ ok: false, reason: 'firm_mismatch' });
  });

  it.each([
    [{ organizationId: '', firmId: 'firm-A' }, resource],
    [{ organizationId: 'org-A', firmId: '' }, resource],
    [{ organizationId: ' ', firmId: 'firm-A' }, resource],
    [{ organizationId: 'org-A', firmId: ' ' }, resource],
    [{ organizationId: 'org-A', firmId: 'firm-A' }, { organizationId: '', firmId: 'firm-A' }],
    [{ organizationId: 'org-A', firmId: 'firm-A' }, { organizationId: 'org-A', firmId: '' }],
  ])('rejects empty or whitespace-only scope values', (actor, target) => {
    expect(assertAdvisoryScope(actor, target).ok).toBe(false);
  });

  it('rejects equal but empty scope values rather than granting access', () => {
    expect(assertAdvisoryScope(
      { organizationId: '', firmId: '' },
      { organizationId: '', firmId: '' }
    ).ok).toBe(false);
  });
});
