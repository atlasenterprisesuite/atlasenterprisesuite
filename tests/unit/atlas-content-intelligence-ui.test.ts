import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const pagePath = 'apps/web/src/modules/creator/content/ContentIntelligencePage.tsx';

describe('ATLAS Content Intelligence workspace UI', () => {
  it('registers the governed /studio/content route and Studio entry point', () => {
    const app = source('apps/web/src/App.tsx');
    const studio = source('apps/web/src/modules/creator/CreatorStudioPage.tsx');
    expect(app).toContain("./modules/creator/content/ContentIntelligencePage");
    expect(app).toContain('path="/studio/content"');
    expect(studio).toContain("route: '/studio/content'");
    expect(studio).toContain("title: 'Content Intelligence'");
  });

  it('implements all seven product stages and persistence actions', () => {
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    if (!existsSync(resolve(process.cwd(), pagePath))) return;
    const page = source(pagePath);
    for (const stage of ['Creator Profile', 'Audience', 'Ideas', 'Hooks', 'Content Builder', 'Repurpose', 'Review']) {
      expect(page).toContain(stage);
    }
    expect(page).toContain('listContentWorkspaces');
    expect(page).toContain('getContentWorkspace');
    expect(page).toContain('saveContentWorkspace');
    expect(page).toContain('generateAudienceInsights');
    expect(page).toContain('generateContentIdeas');
    expect(page).toContain('generateHookVariants');
    expect(page).toContain('buildStructuredDraft');
    expect(page).toContain('repurposeDraft');
    expect(page).toContain('reviewDraft');
  });

  it('connects governed downstream handoff actions without bypassing target gates', () => {
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    if (!existsSync(resolve(process.cwd(), pagePath))) return;
    const page = source(pagePath);
    expect(page).toContain('createDirectorHandoff');
    expect(page).toContain('createPublisherHandoff');
    expect(page).toContain('to="/studio/create?type=video"');
    expect(page).toContain('to="/business/growth/social-publisher"');
    expect(page).toContain('Open in Director');
    expect(page).toContain('Open in Social Publisher');
  });
});
