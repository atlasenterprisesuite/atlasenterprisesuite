import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };

describe('ATLAS navigation intelligence repository contract', () => {
  it('passes the canonical navigation intelligence gate', () => {
    const result = spawnSync(process.execPath, ['scripts/verify-navigation-intelligence.mjs'], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    for (const check of [
      'moduleIdsUnique',
      'moduleRoutesUnique',
      'canonicalGraph',
      'searchUsesGraph',
      'assistantUsesGraph',
      'representedRoutes',
      'gpsCanonical',
      'failClosedUnknown'
    ]) {
      expect(result.stdout).toContain(`ATLAS navigation intelligence ${check}=PASS`);
    }
  });

  it('runs the navigation gate inside canonical verification', () => {
    expect(pkg.scripts?.['verify:navigation']).toBe('node scripts/verify-navigation-intelligence.mjs');
    expect(pkg.scripts?.['verify:all']).toContain('npm run verify:navigation');
    expect(pkg.scripts?.['verify:cloudflare']).toContain('npm run verify:navigation');
  });
});
