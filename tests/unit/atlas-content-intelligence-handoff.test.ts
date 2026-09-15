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
    expect(director).toContain('narration: handoff.narration');
    expect(director).toContain('submitNativeCreatorProduction');
    expect(director).toContain('canRender');
  });

  it('prefills Social Publisher from router state and preserves real connection/media gates', () => {
    const publisher = source('apps/web/src/modules/business/social/SocialPublisherPage.tsx');
    expect(publisher).toContain('useLocation');
    expect(publisher).toContain('atlasContentHandoff');
    expect(publisher).toContain('socialPlatforms.some');
    expect(publisher).toContain('handoff.caption');
    expect(publisher).toContain("connection.status !== 'ready'");
    expect(publisher).toContain('duplicateBlocks.length > 0');
    expect(publisher).toContain('!presence.valid');
  });
});
