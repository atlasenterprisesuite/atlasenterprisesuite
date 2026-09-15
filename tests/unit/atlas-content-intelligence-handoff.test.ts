import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS Content Intelligence governed handoffs', () => {
  it('seeds Director from router state without bypassing render gates', () => {
    const director = source('apps/web/src/modules/creator/director/DirectorWorkspace.tsx');
    expect(director).toContain('useLocation');
    expect(director).toContain('atlasContentHandoff');
    expect(director).toContain('createEmptyProductionSpec');
    expect(director).toContain('handoff.title');
    expect(director).toContain('handoff.brief');
    expect(director).toContain('dialogue: [handoff.narration]');
    expect(director).toContain('submitNativeCreatorProduction');
    expect(director).toContain('nativeGate.allowed');
    expect(director).toContain("nativeReadinessState !== 'ready'");
  });

  it('prefills Social Publisher from router state and preserves real connection/media gates', () => {
    const publisher = source('apps/web/src/modules/business/social/SocialPublisherPage.tsx');
    expect(publisher).toContain('useLocation');
    expect(publisher).toContain('atlasContentHandoff');
    expect(publisher).toContain('socialPlatforms.some');
    expect(publisher).toContain('handoff?.caption');
    expect(publisher).toContain("platform.connectionStatus === 'not_configured'");
    expect(publisher).toContain('media.length === 0');
    expect(publisher).toContain('errors.length > 0');
  });
});
