import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../packages/core/src';

describe('ATLAS permission domains', () => {
  it('keeps accounting admin semantics', () => {
    expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
  });

  it('does not let accounting admin grant voice permissions', () => {
    expect(hasPermission(['accounting.admin'], 'voice.personal.use')).toBe(false);
  });

  it('grants an explicit voice permission', () => {
    expect(hasPermission(['voice.personal.use'], 'voice.personal.use')).toBe(true);
  });
});
