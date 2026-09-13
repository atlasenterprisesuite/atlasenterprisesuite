import { describe, expect, it } from 'vitest';
import { blueprintCatalog } from '../../apps/web/src/modules/blueprints/blueprintCatalog';

describe('ATLAS Library-first blueprint policy', () => {
  it('keeps every canonical blueprint sourced from Library', () => {
    expect(blueprintCatalog.every((item) => item.provenance === 'library')).toBe(true);
  });
});
