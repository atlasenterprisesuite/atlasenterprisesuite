import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ATLAS Spatial Outdoor Office', () => {
  it('registers the authenticated Studio route and navigation entry', () => {
    const app = source('apps/web/src/App.tsx');
    const studio = source('apps/web/src/modules/creator/CreatorStudioPage.tsx');
    const experience = source('apps/web/src/modules/experience/CreatorExperiencePage.tsx');
    expect(app).toContain("path=\"/studio/spatial/outdoor-office\"");
    expect(app).toContain('<RequireAtlasIdentity><OutdoorOfficeWalkthroughPage /></RequireAtlasIdentity>');
    expect(studio).toContain("route: '/studio/spatial/outdoor-office'");
    expect(experience).toContain("to: '/studio/spatial/outdoor-office'");
  });

  it('provides keyboard and on-screen arrow navigation without claiming unverified 3D geometry', () => {
    const page = source('apps/web/src/modules/spatial/OutdoorOfficeWalkthroughPage.tsx');
    expect(page).toContain("event.key === 'ArrowUp'");
    expect(page).toContain("event.key === 'ArrowDown'");
    expect(page).toContain("event.key === 'ArrowLeft'");
    expect(page).toContain("event.key === 'ArrowRight'");
    expect(page).toContain("aria-label=\"Move forward\"");
    expect(page).toContain("aria-label=\"Move back\"");
    expect(page).toContain('Visual-navigation boundary');
    expect(page).toContain('does not claim geometric depth');
  });

  it('ships the approved concept artwork as a local Studio asset', () => {
    expect(existsSync('apps/web/public/atlas/spatial/outdoor-office-concept.svg')).toBe(true);
    const page = source('apps/web/src/modules/spatial/OutdoorOfficeWalkthroughPage.tsx');
    expect(page).toContain("/atlas/spatial/outdoor-office-concept.svg");
  });
});
