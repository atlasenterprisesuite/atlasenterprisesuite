import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routesPath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const homePath = 'apps/web/src/modules/connect/ConnectHomePage.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasBroadcastChannelPage.tsx';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('ATLAS Connect · broadcast channel', () => {
  it('exposes the canonical ATLAS Network route from Connect', () => {
    expect(read(routesPath)).toContain('AtlasBroadcastChannelPage');
    expect(read(routesPath)).toContain('path="/connect/channel"');
    expect(read(homePath)).toContain('to="/connect/channel"');
  });

  it('configures the official ATLAS Network identity and bilingual welcome feed', () => {
    expect(existsSync(pagePath)).toBe(true);
    const source = read(pagePath);
    expect(source).toContain("name: 'ATLAS Network'");
    expect(source).toContain("brand: 'ATLAS Enterprise Suite'");
    expect(source).toContain("language: 'EN'");
    expect(source).toContain("language: 'ES'");
    expect(source).toContain('One Platform. Every Solution. Total Control.');
  });

  it('fails closed for external publishing and does not invent audience metrics', () => {
    const source = read(pagePath);
    expect(source).toContain('Authorization required');
    expect(source).toContain('External provider gate active');
    expect(source).toContain('No follower or member totals are fabricated');
    expect(source).not.toContain('67.1K');
    expect(source).not.toContain('provider connected');
  });
});
