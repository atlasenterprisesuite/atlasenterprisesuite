import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const storagePath = `${root}/apps/web/src/lib/atlasSessionStorage.ts`;
const storage = existsSync(storagePath) ? readFileSync(storagePath, 'utf8') : '';
const session = readFileSync(`${root}/apps/web/src/lib/atlasSession.ts`, 'utf8');

describe('ATLAS browser session storage boundary', () => {
  it('centralizes token persistence behind a dedicated adapter', () => {
    expect(existsSync(storagePath)).toBe(true);
    expect(storage).toContain('readAccessToken');
    expect(storage).toContain('readRefreshToken');
    expect(storage).toContain('writeSession');
    expect(storage).toContain('clearSessionStorage');
  });

  it('keeps direct localStorage access out of atlasSession.ts', () => {
    expect(session).not.toContain('window.localStorage');
    expect(session).toContain("from './atlasSessionStorage'");
  });
});
