import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };

describe('ATLAS neural integrity repository contract', () => {
  it('passes roots, trunk, brain, nerves, bark and senses as one connected system', () => {
    const result = spawnSync(process.execPath, ['scripts/verify-neural-integrity.mjs'], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    for (const system of ['roots', 'trunk', 'brain', 'nerves', 'bark', 'senses']) {
      expect(result.stdout).toContain(`ATLAS neural integrity ${system}=PASS`);
    }
  });

  it('runs the neural gate inside the canonical full verification chain', () => {
    expect(pkg.scripts?.['verify:neural']).toBe('node scripts/verify-neural-integrity.mjs');
    expect(pkg.scripts?.['verify:all']).toContain('npm run verify:neural');
  });
});
