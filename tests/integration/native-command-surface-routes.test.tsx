import { describe, expect, it } from 'vitest';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';

describe('ATLAS native command surface routes', () => {
  it('resolves Blueprints and Orchestrator inside the ATLAS shell extension graph', () => {
    expect(resolveAtlasExtension('/blueprints')).not.toBeNull();
    expect(resolveAtlasExtension('/orchestrator')).not.toBeNull();
  });

  it('preserves existing learning extension routes', () => {
    expect(resolveAtlasExtension('/learning')).not.toBeNull();
    expect(resolveAtlasExtension('/learning/neuroplasticity')).not.toBeNull();
  });
});
