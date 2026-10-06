import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'packages/creator/permissions.ts',
  'packages/creator/creative_engine.ts',
  'packages/creator/prompt_engine.ts',
  'packages/creator/creative_plan.ts',
  'packages/creator/types.ts',
  'packages/creator/validator.ts',
  'packages/creator/motion/validator.ts',
  'packages/creator/providers.ts'
];

describe('atlas-creator Edge bundling imports', () => {
  it('uses explicit extensions for relative imports consumed by Supabase Edge bundling', () => {
    const invalid: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        const match = line.match(/from\s+['"](\.[^'"]+)['"]/);
        if (match && !/\.(ts|tsx|mjs|js|json)$/.test(match[1])) {
          invalid.push(`${file}:${index + 1}:${match[1]}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it('allows explicit TypeScript import extensions in the no-emit bundler config', () => {
    const config = JSON.parse(readFileSync('tsconfig.base.json', 'utf8'));
    expect(config.compilerOptions.noEmit).toBe(true);
    expect(config.compilerOptions.moduleResolution).toBe('Bundler');
    expect(config.compilerOptions.allowImportingTsExtensions).toBe(true);
  });
});
