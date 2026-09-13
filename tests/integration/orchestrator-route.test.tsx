import { describe, expect, it } from 'vitest';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';

describe('ATLAS Orchestrator route', () => {
  it('resolves inside the existing shell extension graph', () => {
    expect(resolveAtlasExtension('/orchestrator')).not.toBeNull();
  });
});
