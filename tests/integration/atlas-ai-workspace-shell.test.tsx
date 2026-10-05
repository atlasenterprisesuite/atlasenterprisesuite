import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AIWorkspaceNav } from '../../apps/web/src/components/ai/AIWorkspaceNav';
import { ATLAS_AI_WORKSPACE_NAVIGATION } from '../../apps/web/src/navigation/atlasNavigation';

const root = process.cwd();
const shellSource = readFileSync(`${root}/apps/web/src/components/AtlasShell.tsx`, 'utf8');

afterEach(cleanup);

function renderNav(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AIWorkspaceNav />
    </MemoryRouter>
  );
}

describe('ATLAS AI workspace contextual navigation', () => {
  it('renders every Wave 1 destination from the canonical projection as a real link', () => {
    renderNav('/assistant');
    const nav = screen.getByRole('navigation', { name: 'ATLAS AI workspace' });
    const links = within(nav).getAllByRole('link');

    expect(links).toHaveLength(ATLAS_AI_WORKSPACE_NAVIGATION.length);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      ATLAS_AI_WORKSPACE_NAVIGATION.map((node) => node.to)
    );
    expect(nav.querySelector('a[href="#"]')).toBeNull();
  });

  it.each([
    ['/assistant', 'assistant'],
    ['/work', 'work'],
    ['/studio', 'studio'],
    ['/studio/ai-universe', 'ai-universe'],
    ['/studio/create', 'studio-create'],
    ['/studio/library', 'creator-library'],
    ['/studio/providers', 'provider-readiness'],
    ['/voice', 'voice'],
    ['/studio/voice', 'voice']
  ])('marks %s as the active Wave 1 destination', (pathname, expectedId) => {
    renderNav(pathname);
    const active = screen.getByRole('link', { current: 'page' });
    expect(active).toHaveAttribute('data-atlas-ai-node', expectedId);
  });

  it('preserves Creator image intent while matching the create pathname', () => {
    renderNav('/studio/create');
    const create = screen.getByRole('link', { name: 'Create', current: 'page' });
    expect(create).toHaveAttribute('href', '/studio/create?type=image');
  });

  it('does not expose deferred Wave 2-4 destinations', () => {
    renderNav('/assistant');
    const nav = screen.getByRole('navigation', { name: 'ATLAS AI workspace' });
    for (const label of ['Projects', 'Deep Research', 'Skills', 'Agents', 'Canvas', 'Notebooks', 'Pages', 'Apps', 'Scheduled', 'Vision', 'Developer']) {
      expect(within(nav).queryByRole('link', { name: label })).toBeNull();
    }
  });

  it('integrates contextually into AtlasShell instead of replacing the global shell', () => {
    expect(shellSource).toContain("import { AIWorkspaceNav } from './ai/AIWorkspaceNav'");
    expect(shellSource).toContain('isAtlasAIWorkspacePath(location.pathname) ? <AIWorkspaceNav /> : null');
    expect(shellSource).toContain('<main>{children}</main>');
    expect(shellSource).toContain('<AtlasAccessibility');
    expect(shellSource).toContain('voiceOwnsAssistantSurface');
  });
});
