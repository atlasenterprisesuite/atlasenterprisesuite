import { describe, expect, it } from 'vitest';
import * as core from '../../packages/core/src/index';

describe('ATLAS integration gateway permissions', () => {
  it('exposes a provider-neutral permission checker', () => {
    expect((core as Record<string, unknown>).hasIntegrationPermission).toBeTypeOf('function');
  });

  it('keeps Google Workspace permissions separate from accounting permissions', () => {
    const hasIntegrationPermission = (core as Record<string, unknown>)
      .hasIntegrationPermission as
      | ((granted: readonly string[], required: string) => boolean)
      | undefined;

    expect(hasIntegrationPermission).toBeTypeOf('function');
    expect(
      hasIntegrationPermission?.(['google.gmail.read'], 'google.gmail.read')
    ).toBe(true);
    expect(
      hasIntegrationPermission?.(['accounting.admin'], 'google.gmail.read')
    ).toBe(false);
  });
});
