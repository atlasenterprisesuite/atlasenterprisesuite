import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ATLAS Web Launch Lab UI and production gate', () => {
  it('routes the workspace through ATLAS Identity and Studio navigation', () => {
    const resolver = source('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const studio = source('apps/web/src/modules/creator/CreatorStudioPage.tsx');
    const experience = source('apps/web/src/modules/experience/CreatorExperiencePage.tsx');
    expect(resolver).toContain("pathname === '/studio/web-launch'");
    expect(resolver).toContain('<RequireAtlasIdentity><WebLaunchPage /></RequireAtlasIdentity>');
    expect(studio).toContain("title: 'Web Launch Lab'");
    expect(studio).toContain("route: '/studio/web-launch'");
    expect(experience).toContain("to: '/studio/web-launch'");
  });

  it('implements the seven video-derived stages and real save/load actions', () => {
    const page = source('apps/web/src/modules/creator/web/WebLaunchPage.tsx');
    for (const stage of ['Master Plan', 'First Impression', 'Motion System', 'Conversion Copy', 'Construction Plan', 'Conversion Audit', '30-Day Launch']) {
      expect(page).toContain(stage);
    }
    expect(page).toContain('Generate all 7 stages');
    expect(page).toContain('listWebLaunchBlueprints');
    expect(page).toContain('getWebLaunchBlueprint');
    expect(page).toContain('saveWebLaunchBlueprint');
    expect(page).toContain('to="/studio/library"');
    expect(page).toContain('to="/execution/manager/readiness"');
  });

  it('includes the new route in both direct and authorized fail-closed production verification', () => {
    const contract = source('data/ops/global-production-verification.json');
    const verifier = source('supabase/functions/atlas-cloudflare-production-http-verify/index.ts');
    expect(contract).toContain('"default_mode": "fail-closed"');
    expect(contract).toContain('"/studio/web-launch"');
    expect(verifier).toContain("probe('/studio/web-launch')");
    expect(verifier).toContain('studio_web_launch_route_reachable');
    for (const route of ['/business/network', '/business/network/pricing', '/business/network/commissions', '/business/network/payouts', '/business/network/compliance']) {
      expect(contract).toContain(route);
    }
  });
});
