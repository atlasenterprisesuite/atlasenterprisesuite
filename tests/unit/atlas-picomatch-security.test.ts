import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const picomatch = require('picomatch') as {
  makeRe(pattern: string): RegExp;
  isMatch(input: string, pattern: string): boolean;
};
const installed = require('picomatch/package.json') as {
  name: string;
  version: string;
};
const provenance = JSON.parse(
  readFileSync('vendor/atlas-picomatch-secure.PROVENANCE.json', 'utf8'),
) as {
  upstreamCommit: string;
  tarballSha256: string;
};

describe('ATLAS Picomatch Secure supply-chain boundary', () => {
  it('uses the ATLAS package identity pinned to reviewed provenance', () => {
    expect(installed.name).toBe('@atlas/picomatch-secure');
    expect(installed.version).toBe('4.0.8-atlas.1');
    expect(provenance.upstreamCommit).toBe(
      '44f192261f312ddf236cb7bdc05d8f22663f98f9',
    );
  });

  it('matches the vendored tarball SHA-256 exactly', () => {
    const digest = createHash('sha256')
      .update(readFileSync('vendor/atlas-picomatch-secure.tgz'))
      .digest('hex');
    expect(digest).toBe(provenance.tarballSha256);
  });

  it('literalizes CVE-2026-112366 risky extglob forms', () => {
    expect(picomatch.makeRe('+(*a)').source).toBe('^(?:\\+\\(\\*a\\))$');
    expect(picomatch.makeRe('*(*a)').source).toBe('^(?:\\*\\(\\*a\\))$');

    for (const pattern of ['+(*a)', '*(*a)']) {
      const start = performance.now();
      expect(picomatch.isMatch('a'.repeat(80) + '!', pattern)).toBe(false);
      expect(performance.now() - start).toBeLessThan(250);
    }
  });
});
