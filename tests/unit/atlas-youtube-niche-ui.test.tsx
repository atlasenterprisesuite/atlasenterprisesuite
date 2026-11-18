import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { YouTubeNicheResearchPanel } from '../../apps/web/src/modules/creator/content/YouTubeNicheResearchPanel';

describe('ATLAS 777 YouTube niche explorer UI contract', () => {
  it('renders the ten transcript topics with real, accessible actions and an honest gate', () => {
    const markup = renderToStaticMarkup(<YouTubeNicheResearchPanel onUseNiche={() => {}} />);
    expect(markup).toContain('Explorador de 10 nichos');
    expect(markup).toContain('FG89iOZOG4I');
    expect(markup).toContain('Buscar entre los diez temas');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('NO_GO');
    expect(markup).toContain('Usar este nicho en Content Intelligence');
    expect((markup.match(/youtube-niche-choice selected|youtube-niche-choice"/g) || []).length).toBe(10);
    expect(markup).not.toMatch(/Ingresos garantizados|Monetización activada/i);
  });

  it('reuses Content Intelligence and does not bypass the existing publisher', () => {
    const source = readFileSync(resolve(process.cwd(),
      'apps/web/src/modules/creator/content/ContentIntelligencePage.tsx'), 'utf8');
    expect(source).toContain('YouTubeNicheResearchPanel onUseNiche={useYouTubeNiche}');
    expect(source).toContain('makeYouTubeNicheResearchSeed');
    expect(source).toContain('saveContentWorkspace(workspace, workspace.version)');
    expect(source).toContain('createPublisherHandoff(selectedVariant');
    expect(source).not.toContain('publishYoutubeVideo(');
  });
});
