import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('ATLAS Pay public experience', () => {
  it('serves a public ATLAS Pay product page before the authenticated shell resolver', () => {
    const app = read('apps/web/src/App.tsx');
    expect(app).toContain("PublicAtlasPayPage");
    expect(app).toContain("location.pathname === '/finance/pay'");
    expect(app.indexOf("location.pathname === '/finance/pay'"))
      .toBeLessThan(app.indexOf('resolveAtlasExtension(location.pathname)'));
  });

  it('keeps the operational ATLAS Pay dashboard on a protected workspace route', () => {
    const app = read('apps/web/src/App.tsx');
    const page = read('apps/web/src/modules/finance/pay/PublicAtlasPayPage.tsx');
    expect(app).toContain('path="/finance/pay/workspace"');
    expect(app).toContain('<RequireAtlasIdentity><AtlasPayPage /></RequireAtlasIdentity>');
    expect(page).toContain('/identity?app=%2Ffinance%2Fpay%2Fworkspace');
  });

  it('shows the approved public capability architecture without exposing private financial state', () => {
    const page = read('apps/web/src/modules/finance/pay/PublicAtlasPayPage.tsx');
    for (const label of [
      'ATLAS Wallet',
      'Accounts Center',
      'Earnings & Rewards',
      'Payout Hub',
      'ATLAS Issuing',
      'Security & Compliance',
      'Financial Network'
    ]) expect(page).toContain(label);

    expect(page).toContain('No customer balance, provider credential or account identifier is exposed here');
    expect(page).not.toContain('loadAtlasPaySnapshot');
    expect(page).not.toContain('atlas_pay_provider_connections');
  });

  it('ships a dedicated responsive public visual layer and production verification route', () => {
    const page = read('apps/web/src/modules/finance/pay/PublicAtlasPayPage.tsx');
    const css = read('apps/web/src/modules/finance/pay/public-atlas-pay.css');
    const contract = read('data/ops/global-production-verification.json');
    expect(page).toContain("import './public-atlas-pay.css'");
    expect(css).toContain('.atlas-pay-public');
    expect(css).toContain('@media');
    expect(css).toContain('prefers-reduced-motion');
    expect(contract).toContain('"/finance/pay"');
  });
});
