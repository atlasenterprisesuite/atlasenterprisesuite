import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const page = readFileSync('apps/web/src/modules/finance/pay/AtlasPayPage.tsx', 'utf8');
const core = readFileSync('packages/pay/src/index.ts', 'utf8');

describe('ATLAS Pay web integration', () => {
  it('exposes ATLAS Pay from Finance behind identity', () => {
    expect(app).toContain("import { AtlasPayPage } from './modules/finance/pay/AtlasPayPage'");
    expect(app).toContain('to="/finance/pay"');
    expect(app).toContain('path="/finance/pay" element={<RequireAtlasIdentity><AtlasPayPage /></RequireAtlasIdentity>}');
    expect(registry).toContain("id: 'pay'");
    expect(registry).toContain("route: '/finance/pay'");
    expect(registry).toContain("readiness: 'external-gated'");
  });

  it('never represents regulated issuing or payout rails as live by default', () => {
    expect(page).toContain('External-gated');
    expect(page).toContain('does not claim a bank charter');
    expect(page).toContain('without authenticated provider evidence');
    expect(core).toContain('UnavailableIssuingAdapter');
    expect(core).toContain('UnavailablePayoutAdapter');
    expect(core).toContain('regulatoryCoverageVerified');
  });

  it('preserves Accounting as the canonical ledger', () => {
    expect(page).toContain('Accounting remains the canonical general ledger');
    expect(core).toContain('ATLAS Pay does not create a shadow ledger');
  });
});
