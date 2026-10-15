import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const pagePath = 'apps/web/src/work/WorkOSPage.tsx';

describe('ATLAS Work OS', () => {
  it('registers Work OS inside the existing Work route graph and subnavigation', () => {
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    const routes = source('apps/web/src/work/WorkRoutes.tsx');
    const subnav = source('apps/web/src/work/WorkSubnav.tsx');
    expect(routes).toContain("import { WorkOSPage } from './WorkOSPage'");
    expect(routes).toContain('path="/work/os"');
    expect(routes).toContain('<WorkOSPage />');
    expect(subnav).toContain("to: '/work/os'");
    expect(subnav).toContain("label: 'Work OS'");
    expect(routes).toContain('path="/work/board"');
    expect(subnav).toContain("to: '/work/board'");
  });

  it('reuses canonical ATLAS modules instead of creating disconnected product silos', () => {
    const page = source(pagePath);
    for (const route of [
      '/studio/write',
      '/analytics',
      '/knowledge',
      '/assistant',
      '/studio/productivity-pro',
      '/automations',
      '/execution/manager/readiness',
      '/finance/accounting',
      '/inventory/procure-to-pay',
      '/identity',
      '/cloud'
    ]) {
      expect(page).toContain(route);
    }
    expect(page).toContain("to: '/work/board'");
    expect(page).toContain('Existing modules are reused instead of duplicated');
    expect(page).toContain('Identity → Graph → Data → Knowledge → AI → Automation → Security → Apps');
  });

  it('keeps unavailable or provider-dependent capabilities explicitly gated', () => {
    const page = source(pagePath);
    for (const boundary of [
      'External mailbox authorization is required',
      'No calendar is represented as connected',
      'Dedicated form-builder UI is not yet implemented',
      'A canonical ATLAS Drive route is not yet registered',
      'A live meeting provider must be authorized'
    ]) {
      expect(page).toContain(boundary);
    }
    expect(page).toContain("status: 'gated'");
    expect(page).toContain('No application can create a private identity silo');
  });

  it('indexes Work OS capabilities in global ATLAS navigation search', () => {
    const navigation = source('apps/web/src/navigation/atlasNavigation.ts');
    expect(navigation).toContain("id: 'work-os'");
    expect(navigation).toContain("to: '/work/os'");
    for (const keyword of ['docs', 'sheets', 'calendar', 'tasks', 'projects', 'forms', 'drive', 'automation']) {
      expect(navigation).toContain(`'${keyword}'`);
    }
  });

  it('documents production truth separately from implementation state', () => {
    const architecture = source('docs/architecture/ATLAS_WORK_OS.md');
    expect(architecture).toContain('Production status requires CI, merge, deployment and public verification.');
    expect(architecture).toContain('Provider-dependent capability remains fail-closed');
    expect(architecture).toContain('The deployed production commit matches the merged commit.');
    expect(architecture).toContain('Public production verification completes without a P0 failure.');
  });
});
