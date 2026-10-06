import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ATLAS Dependency Ecology', () => {
  it('has a dedicated release-domain dependency ecology module', () => {
    expect(
      existsSync(resolve(process.cwd(), 'apps/web/src/modules/release/dependency-ecology.ts'))
    ).toBe(true);
  });
});
