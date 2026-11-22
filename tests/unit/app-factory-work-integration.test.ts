import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('App Factory Work preview integration boundaries', () => {
  it('registers the route and marks Work OS entry gated', () => {
    const routes = read('../../apps/web/src/work/WorkRoutes.tsx');
    const os = read('../../apps/web/src/work/WorkOSPage.tsx');
    expect(routes).toContain('path="/work/app-factory"');
    expect(os).toContain("name: 'App Factory'");
    expect(os).toMatch(/name: 'App Factory'[^\n]*status: 'gated'/);
  });
  it('renders untrusted preview only through a sandboxed iframe', () => {
    const page = read('../../apps/web/src/work/AppFactoryPreviewPage.tsx');
    expect(page).toContain('sandbox=""');
    expect(page).toContain('referrerPolicy="no-referrer"');
    expect(page).toContain('srcDoc={preview.preview.html}');
    expect(page).not.toContain('dangerouslySetInnerHTML');
  });
  it('keeps preview local and does not call authorization or deployment APIs', () => {
    const page = read('../../apps/web/src/work/AppFactoryPreviewPage.tsx');
    expect(page).toContain('local_preview_only');
    expect(page).not.toMatch(/fetch\s*\(|supabase\.from\s*\(|deploy\s*\(/);
  });
});
