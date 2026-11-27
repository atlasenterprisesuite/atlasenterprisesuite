import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS sovereign build contract', () => {
  it('builds the web workspace and writes the canonical manifest without legacy copying', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toBe('npm --workspace apps/web run build && node scripts/write-deployment-manifest.mjs apps/web/dist/deployment.json');
  });
  it('keeps Cloudflare assets on the canonical web output', () => {
    const config = readFileSync('wrangler.jsonc', 'utf8');
    expect(config).toMatch(/"directory"\s*:\s*"\.\/apps\/web\/dist"/);
  });
});
