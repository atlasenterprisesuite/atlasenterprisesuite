import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import { AtlasModuleArtwork } from '../../apps/web/src/modules/integration/AtlasModuleArtwork';

describe('ATLAS Suite canonical artwork', () => {
  it('renders a unique 16:9 vector composition for every registered module', () => {
    const examples = new Set<string>();
    for (const module of ATLAS_MODULES) {
      const markup = renderToStaticMarkup(<AtlasModuleArtwork module={module} />);
      expect(markup).toContain('data-module-id="' + module.id + '"');
      expect(markup).toContain('viewBox="0 0 640 360"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('ATLAS');
      examples.add(markup);
    }
    expect(examples.size).toBe(ATLAS_MODULES.length);
  });

  it('integrates the artwork in primary cards and the full A-Z directory without duplicating routes', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/integration/AtlasSuitePage.tsx'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/integration/atlas-suite.css'), 'utf8');
    expect(source).toContain('<AtlasModuleArtwork module={module} />');
    expect(source).toContain('<AtlasModuleArtwork module={system.module} />');
    expect(source).not.toContain('index % COVER_ASSETS');
    expect(source).toContain('to={module.route}');
    expect(css).toContain('.suite-module-artwork');
    expect(css).toContain('aspect-ratio:16/9');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
});