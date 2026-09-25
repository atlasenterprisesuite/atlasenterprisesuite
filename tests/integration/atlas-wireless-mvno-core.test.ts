import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const routesPath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const homePath = 'apps/web/src/modules/connect/ConnectHomePage.tsx';
const wirelessPath = 'apps/web/src/modules/connect/AtlasWirelessPage.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasMvnoControlPage.tsx';
const typesPath = 'apps/web/src/modules/connect/mvno/types.ts';
const docsPath = 'docs/atlas-wireless/MVNO_CORE.md';

describe('ATLAS Wireless MVNO pilot core', () => {
  it('registers the governed MVNO pilot route and navigation', () => {
    expect(read(routesPath)).toContain('path="/connect/wireless/mvno"');
    expect(read(homePath)).toContain('to="/connect/wireless/mvno"');
    expect(read(wirelessPath)).toContain('to="/connect/wireless/mvno"');
  });

  it('keeps pilot activation fail-closed until external carrier evidence exists', () => {
    const page = read(pagePath);
    const docs = read(docsPath);

    expect(page).toContain('Pilot state: pending_provider');
    expect(page).toContain('No mock, fixture or static UI state can satisfy activation');
    expect(page).not.toContain('Pilot state: active');
    expect(docs).toContain('No mock, static fixture, or UI action may move a subscriber into `active`');
    expect(docs).toContain('credentials must never be committed to source control');
  });

  it('defines a provider-neutral subscriber lifecycle contract without provider secrets', () => {
    const types = read(typesPath);

    for (const method of ['provision', 'getSubscriber', 'activate', 'suspend', 'reconnect', 'revoke']) {
      expect(types).toContain(`${method}(`);
    }
    for (const capability of ['esim', 'voice', 'sms_mms', 'mobile_data', 'hotspot', 'number_management', 'usage_events', 'e911']) {
      expect(types).toContain(`'${capability}'`);
    }
    expect(types).not.toMatch(/api[_-]?key|client[_-]?secret|bearer[_-]?token/i);
  });
});
