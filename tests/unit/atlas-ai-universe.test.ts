import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS AI Universe launchpad', () => {
  it('exposes the canonical multimodal entry points from Studio', () => {
    const experience = source('apps/web/src/modules/experience/CreatorExperiencePage.tsx');

    expect(experience).toContain("eyebrow: 'AI Universe'");
    expect(experience).toContain("title: 'Multi-provider Assistant'");
    expect(experience).toContain("to: '/assistant'");
    expect(experience).toContain("to: '/studio/create?type=image'");
    expect(experience).toContain("to: '/studio/create?type=video'");
    expect(experience).toContain("to: '/studio/create?type=music'");
    expect(experience).toContain("to: '/studio/voice'");
    expect(experience).toContain("to: '/studio/write'");
    expect(experience).toContain("to: '/studio/content'");
    expect(experience).toContain("to: '/studio/providers'");
  });

  it('keeps truthful readiness language in the Studio surface and architecture contract', () => {
    const experience = source('apps/web/src/modules/experience/CreatorExperiencePage.tsx');
    const architecture = source('docs/architecture/ATLAS_AI_UNIVERSE.md');

    expect(experience).toContain('External generation remains unavailable until verified provider readiness');
    expect(architecture).toContain('No provider is shown as connected or executable unless readiness is verified server-side.');
    expect(architecture).toContain('It does not claim that every listed third-party model is integrated');
  });
});
