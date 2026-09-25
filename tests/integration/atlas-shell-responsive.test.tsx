import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const shell = readFileSync(resolve(root, 'apps/web/src/components/AtlasShell.tsx'), 'utf8');
const styles = readFileSync(resolve(root, 'apps/web/src/styles.css'), 'utf8');
const assistantStyles = readFileSync(resolve(root, 'apps/web/src/components/assistant/assistant.css'), 'utf8');

describe('ATLAS responsive shell contract', () => {
  it('uses an accessible off-canvas navigation control on mobile', () => {
    expect(shell).toContain('aria-controls="atlas-primary-navigation"');
    expect(shell).toContain('aria-expanded={mobileNavOpen}');
    expect(shell).toContain("mobileNavOpen ? 'atlas-sidebar is-open' : 'atlas-sidebar'");
    expect(shell).toContain('atlas-nav-backdrop');
    expect(shell).toContain("event.key === 'Escape'");
  });

  it('switches the desktop sidebar to a mobile drawer before tablet width', () => {
    expect(styles).toContain('@media(max-width:1024px)');
    expect(styles).toContain('.atlas-sidebar{position:fixed');
    expect(styles).toContain('transform:translateX(-105%)');
    expect(styles).toContain('.atlas-sidebar.is-open{transform:translateX(0)}');
    expect(styles).toContain('.atlas-workspace{width:100%;min-width:0;overflow-x:clip}');
  });

  it('keeps the mobile Assistant launcher compact enough to avoid obscuring page content', () => {
    expect(assistantStyles).toContain('@media(max-width:760px)');
    expect(assistantStyles).toContain('.atlas-assistant-root{right:max(8px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom))}');
    expect(assistantStyles).toContain('.atlas-assistant-launcher{width:56px;height:56px;border-radius:18px}');
    expect(assistantStyles).toContain('.atlas-assistant-launcher-status{width:14px;height:14px;border-width:2px}');
  });

  it('keeps public identity state truthful without bypassing the canonical bootstrap flow', () => {
    expect(shell).toContain('getAtlasAccessToken');
    expect(shell).toContain('getCachedAtlasShellOrganization');
    expect(shell).not.toContain('getActiveAtlasOrganization');
    expect(shell).toContain("'Public workspace'");
    expect(shell).toContain("'PUBLIC'");
    expect(shell).toContain('to="/identity"');
  });
});
