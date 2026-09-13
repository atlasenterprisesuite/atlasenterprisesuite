import { describe, expect, it } from 'vitest';
import { atlasNavigation } from '../../apps/web/src/navigation/atlasNavigation';
import { blueprintCatalog } from '../../apps/web/src/modules/blueprints/blueprintCatalog';

describe('ATLAS native command surface smoke', () => {
  it('keeps Blueprints and Orchestrator in the implemented graph', () => {
    expect(atlasNavigation.find((item) => item.id === 'blueprints')?.availability).toBe('implemented');
    expect(atlasNavigation.find((item) => item.id === 'orchestrator')?.availability).toBe('implemented');
    expect(blueprintCatalog.length).toBeGreaterThanOrEqual(7);
  });
});
