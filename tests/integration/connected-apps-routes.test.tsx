import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const nav = readFileSync('apps/web/src/navigation/atlasNavigation.ts', 'utf8');
const shell = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const prod = readFileSync('data/ops/global-production-verification.json', 'utf8');
const verifier = readFileSync('supabase/functions/atlas-cloudflare-production-http-verify/index.ts', 'utf8');

describe('Connected Apps route and production contract', () => {
  it('mounts Settings Security and Assistant surfaces without a new top-level module', () => {
    for (const route of ['/settings/connected-apps', '/security/external-access', '/assistant/apps']) {
      expect(app).toContain(route);
      expect(nav).toContain(route);
    }
    expect(shell).toContain('/settings/connected-apps');
    expect(app).not.toContain('Connected Apps Home');
  });

  it('keeps the dynamic detail route behind the same app route tree', () => {
    expect(app).toContain('/settings/connected-apps/:connectionId');
  });

  it('adds stable Connected Apps surfaces to fail-closed production verification', () => {
    for (const route of ['/settings/connected-apps', '/security/external-access', '/assistant/apps']) {
      expect(prod).toContain(route);
      expect(verifier).toContain(route);
    }
  });
});
