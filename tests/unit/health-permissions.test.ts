import { describe, expect, it } from 'vitest';
import { canUseHealthPermission } from '../../packages/health/src';

describe('Health permission governance', () => {
  it('requires explicit Health permissions while allowing Health admin', () => {
    expect(canUseHealthPermission(['health.read'], 'health.facilities.write')).toBe(false);
    expect(canUseHealthPermission(['health.admin'], 'health.facilities.write')).toBe(true);
  });
});
