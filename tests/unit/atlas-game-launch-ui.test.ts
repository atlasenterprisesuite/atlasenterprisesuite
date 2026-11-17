import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ATLAS Content Intelligence game-launch integration', () => {
  it('reuses the existing authenticated Content Intelligence route and Director', () => {
    const page = read('apps/web/src/modules/creator/content/ContentIntelligencePage.tsx');
    expect(page).toContain('GameLaunchPlannerPanel');
    expect(page).toContain('chooseLaunchIdea');
    expect(page).toContain('createDirectorHandoff');
    expect(page).toContain('to="/studio/create?type=video"');
    expect(page).toContain('launch-game-');
  });

  it('never offers a publisher handoff for unverified launch ideas', () => {
    const page = read('apps/web/src/modules/creator/content/ContentIntelligencePage.tsx');
    expect(page).toContain("!workspace.draft?.ideaId.startsWith('launch-game-')");
    expect(page).toContain('Publication blocked for game-launch concepts');
  });

  it('labels generated prompts as hypotheses with a truthful NO_GO gate', () => {
    const panel = read('apps/web/src/modules/creator/content/GameLaunchPlannerPanel.tsx');
    expect(panel).toContain('buildGameLaunchIdeaPack');
    expect(panel).toContain('assessGameLaunchHandoff');
    expect(panel).toContain('editorial hypotheses');
    expect(panel).toContain('NO_GO');
    expect(panel).not.toContain('uploadVideo(');
    expect(panel).not.toContain('publishVideo(');
  });
});
