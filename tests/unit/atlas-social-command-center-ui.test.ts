import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS Social Command Center routing', () => {
  it('registers an identity-gated studio route and entry point', () => {
    const resolver = source('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const studio = source('apps/web/src/modules/creator/CreatorStudioPage.tsx');
    expect(resolver).toContain("../modules/creator/social/SocialCommandCenterPage");
    expect(resolver).toContain("pathname === '/studio/social'");
    expect(resolver).toContain('RequireAtlasIdentity');
    expect(studio).toContain("route: '/studio/social'");
  });

  it('keeps provider execution fail-closed while supporting persisted inbox and schedule workflows', () => {
    const pagePath = resolve(process.cwd(), 'apps/web/src/modules/creator/social/SocialCommandCenterPage.tsx');
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    expect(page).toContain('listSocialInboxThreads');
    expect(page).toContain('createImportedSocialThread');
    expect(page).toContain('createSocialSchedule');
    expect(page).toContain("to=\"/business/growth/social-publisher\"");
    expect(page).toContain("navigate('/crm/social-handoff'");
  });
});
