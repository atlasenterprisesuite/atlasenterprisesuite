import React from 'react';
import { describe, expect, it } from 'vitest';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { RequireAtlasIdentity } from '../../apps/web/src/identity/RequireAtlasIdentity';
import { OracleRoutes } from '../../apps/web/src/modules/oracle/OracleRoutes';

describe('ATLAS Private Oracle route regression', () => {
  it('registers the Oracle only as an identity-gated private extension', () => {
    const extension = resolveAtlasExtension('/assistant/oracle');
    expect(React.isValidElement(extension)).toBe(true);
    expect(extension?.type).toBe(RequireAtlasIdentity);
    expect((extension?.props as { children?: React.ReactElement }).children?.type).toBe(OracleRoutes);
  });

  it('recognizes nested private Oracle URLs through the same gate', () => {
    const extension = resolveAtlasExtension('/assistant/oracle/readings/reading-1');
    expect(extension?.type).toBe(RequireAtlasIdentity);
  });

  it('preserves the Oracle return path through ATLAS Identity', () => {
    expect(resolveAtlasIdentityTarget('/assistant/oracle')).toBe('/assistant/oracle');
    expect(resolveAtlasIdentityTarget('/assistant/oracle/deck')).toBe('/assistant/oracle/deck');
  });

  it('preserves existing supported identity targets and rejects external redirects', () => {
    expect(resolveAtlasIdentityTarget('/finance/accounting')).toBe('/finance/accounting');
    expect(resolveAtlasIdentityTarget('/health')).toBe('/health');
    expect(resolveAtlasIdentityTarget('/studio')).toBe('/studio');
    expect(resolveAtlasIdentityTarget('https://example.com')).toBe('/');
    expect(resolveAtlasIdentityTarget('//example.com')).toBe('/');
  });
});
