import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Cloud production verification dashboard', () => {
  const routes = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/AtlasCloudRoutes.tsx', 'utf8');
  const next = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx', 'utf8');
  const page = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/AtlasCloudProductionVerification.tsx', 'utf8');
  const css = readFileSync(process.cwd() + '/apps/web/src/modules/cloud/cloud.css', 'utf8');

  it('routes and exposes the production verification surface', () => {
    expect(routes).toContain('/cloud/production-verification');
    expect(routes).toContain('AtlasCloudProductionVerification');
    expect(next).toContain('/cloud/production-verification');
  });

  it('uses canonical live authorities rather than hard-coded poster state', () => {
    expect(page).toContain('atlas-observability');
    expect(page).toContain('atlas-release-control');
    expect(page).toContain('latest_verifications');
    expect(page).toContain('source_ref');
    expect(page).toContain('status values are never hard-coded');
  });

  it('fails closed when mandatory evidence is absent or failed', () => {
    expect(page).toContain('VERIFICATION HOLD');
    expect(page).toContain('NOT PRODUCTION VERIFIED');
    expect(page).toContain('FINAL PRODUCTION VERIFIED — FULL');
    expect(page).toContain('required: true');
    expect(page).toContain("state === 'failed'");
  });

  it('implements the approved visual system responsively', () => {
    expect(css).toContain('.atlas-production-hero');
    expect(css).toContain('.atlas-production-check-grid');
    expect(css).toContain('.atlas-production-advisory');
    expect(css).toContain('@media(max-width:720px)');
  });
});
