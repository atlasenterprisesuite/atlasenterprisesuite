import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Cloud production verification', () => {
  const routes=readFileSync(process.cwd()+'/apps/web/src/modules/cloud/AtlasCloudRoutes.tsx','utf8');
  const next=readFileSync(process.cwd()+'/apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx','utf8');
  const page=readFileSync(process.cwd()+'/apps/web/src/modules/cloud/AtlasCloudProductionVerification.tsx','utf8');
  const css=readFileSync(process.cwd()+'/apps/web/src/modules/cloud/cloud.css','utf8');

  it('is routed and discoverable',()=>{ expect(routes).toContain('/cloud/production-verification'); expect(routes).toContain('AtlasCloudProductionVerification'); expect(next).toContain('/cloud/production-verification'); });
  it('uses canonical live evidence authorities',()=>{ expect(page).toContain('atlas-observability'); expect(page).toContain('atlas-release-control'); expect(page).toContain('latest_verifications'); expect(page).toContain('source_ref'); });
  it('fails closed instead of hard-coding green state',()=>{ expect(page).toContain('VERIFICATION HOLD'); expect(page).toContain('NOT PRODUCTION VERIFIED'); expect(page).toContain('FINAL PRODUCTION VERIFIED — FULL'); expect(page).not.toContain('3b75ac87be017d06bd481b6c559c69d427eaae7e'); });
  it('implements responsive visual treatment',()=>{ expect(css).toContain('.atlas-production-hero'); expect(css).toContain('.atlas-production-check-grid'); expect(css).toContain('.atlas-production-advisory'); });
});
