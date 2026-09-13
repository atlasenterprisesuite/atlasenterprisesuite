import { describe, expect, it } from 'vitest';
import { blueprintCatalog } from '../../apps/web/src/modules/blueprints/blueprintCatalog';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';

describe('ATLAS Blueprints route', () => {
  it('resolves inside the existing ATLAS extension graph', () => {
    expect(resolveAtlasExtension('/blueprints')).not.toBeNull();
  });

  it('links only records with real implementation routes', () => {
    const routed = blueprintCatalog.filter((item) => item.moduleRoute);
    expect(routed.every((item) => item.implementationStatus !== 'catalog')).toBe(true);
  });
});
