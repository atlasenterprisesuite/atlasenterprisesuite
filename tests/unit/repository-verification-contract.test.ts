import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

describe('repository-wide verification contract', () => {
  it('defines edge, python and all-repository verification scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['verify:edge']).toBeTruthy();
    expect(pkg.scripts?.['verify:python']).toBeTruthy();
    expect(pkg.scripts?.['verify:all']).toContain('verify:edge');
    expect(pkg.scripts?.['verify:all']).toContain('verify:python');
  });

  it('uses the shared repository verification contract in production workflows', () => {
    for (const path of ['.github/workflows/production-deploy.yml', '.github/workflows/cloudflare-deploy.yml']) {
      expect(read(path), path).toContain('npm run verify:all');
    }
  });
});
