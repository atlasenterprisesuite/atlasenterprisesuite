import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('root router sanity', () => {
  it('does not leave unreachable routing logic after the generic App return', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/web/src/main.tsx'), 'utf8');
    expect(source).not.toMatch(/return <App \/>;\s*if \(location\.pathname/);
  });
});
