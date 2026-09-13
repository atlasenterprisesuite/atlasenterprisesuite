import { describe, expect, it } from 'vitest';
import { atlasNavigation } from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS command surface activation boundaries', () => {
  it('does not mark unimplemented operational modules as live', () => {
    for (const id of ['crm-sales', 'hr', 'inventory', 'purchasing', 'atlas-pay', 'ride']) {
      expect(atlasNavigation.find((item) => item.id === id)?.availability).toBe('catalog');
    }
  });
});
