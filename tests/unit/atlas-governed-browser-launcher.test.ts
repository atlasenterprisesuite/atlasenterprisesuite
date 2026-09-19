import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('tools/local-agent/atlas-governed-browser.mjs', 'utf8');

describe('ATLAS governed browser launcher', () => {
  it('always uses a dedicated non-default profile and loopback debugging', () => {
    expect(source).toContain('--remote-debugging-address=127.0.0.1');
    expect(source).toContain('--user-data-dir=');
    expect(source).toContain("'.atlas', 'governed-browser-profile'");
    expect(source).not.toContain('--remote-debugging-address=0.0.0.0');
  });

  it('keeps runtime credentials out of command line arguments', () => {
    expect(source).toContain('ATLAS_WORK_RUNTIME_TOKEN');
    expect(source).not.toMatch(/--token|--secret|--password/);
    expect(source).toContain("spawn(process.execPath, [RUNTIME_PATH]");
  });
});
