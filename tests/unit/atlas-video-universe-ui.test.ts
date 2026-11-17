import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const director = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/director/DirectorWorkspace.tsx'), 'utf8');
const panel = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/director/VideoUniversePanel.tsx'), 'utf8');
const studio = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/CreatorStudioPage.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/director/video-universe.css'), 'utf8');

describe('ATLAS Video Universe source integration', () => {
  it('extends the existing Director provider step and preserves Avatar 6 handoff', () => {
    expect(director).toContain("import { VideoUniversePanel } from './VideoUniversePanel'");
    expect(director).toContain('<VideoUniversePanel spec={state.spec} providers={providers} nativeReadinessState={nativeReadinessState} />');
    expect(director).toContain('<Avatar6HandoffPanel spec={state.spec} />');
    expect(director).toContain('<ProviderGate providers={providers}');
  });

  it('uses a navigable existing Video Lab route without creating a parallel app', () => {
    expect(studio).toContain("/studio/create?type=video&workspace=video-universe");
    expect(director).toContain("new URLSearchParams(location.search).get('workspace') === 'video-universe'");
  });

  it('offers working local copy/export controls and real internal navigation', () => {
    expect(panel).toContain('navigator.clipboard.writeText');
    expect(panel).toContain('URL.createObjectURL(blob)');
    expect(panel).toContain('anchor.click()');
    for (const route of ['/studio/library', '/studio/voice', '/studio/teleprompter', '/studio/providers']) {
      expect(panel).toContain('to="' + route + '"');
    }
    expect(panel).not.toContain('href="#"');
    expect(panel).not.toMatch(/\bfetch\s*\(|x-api-key|Bearer |import\.meta\.env/);
  });

  it('marks all output as planning-only and discloses synthetic media', () => {
    expect(panel).toContain('Planning only');
    expect(panel).toContain('AI-generated content must be disclosed');
    expect(panel).toContain('server-verified identity, tenant permissions, credits and idempotency');
    expect(panel).toContain('consent must be provider-verified');
    expect(panel).toContain('input type="radio"');
  });

  it('supports mobile and visible keyboard focus', () => {
    expect(css).toContain('@media (max-width: 850px)');
    expect(css).toContain('@media (max-width: 460px)');
    expect(css).toContain(':focus-visible');
  });
});
