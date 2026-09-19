import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAviationPersistenceState } from '../../apps/web/src/modules/aviation/aviation-persistence';

describe('ATLAS Aviation saved/alerts persistence boundary', () => {
  it('distinguishes not-configured, restricted and ready capability states', () => {
    expect(resolveAviationPersistenceState({ adapterConfigured: false, authorized: true })).toBe('not_configured');
    expect(resolveAviationPersistenceState({ adapterConfigured: true, authorized: false })).toBe('restricted');
    expect(resolveAviationPersistenceState({ adapterConfigured: true, authorized: true })).toBe('ready');
  });

  it('does not fake durable Aviation persistence in browser storage', () => {
    const source = readFileSync('apps/web/src/modules/aviation/aviation-persistence.ts', 'utf8');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });
});
