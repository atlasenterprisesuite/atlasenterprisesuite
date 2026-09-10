import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS AI Council core', () => {
  it('provides a provider-independent core entrypoint', () => {
    expect(existsSync('packages/ai-council-core/src/index.ts')).toBe(true);
  });
});
