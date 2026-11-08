import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const styles = readFileSync('apps/web/src/styles.css', 'utf8');
const acceptance = JSON.parse(
  readFileSync('data/ops/module-production-acceptance.json', 'utf8')
) as {
  shared_ux_evidence?: Record<string, { state: string; source: string; evidence: string }>;
};

describe('ATLAS persistent shell navigation context', () => {
  it('provides persistent Back, Forward and Home controls', () => {
    expect(shell).toContain('aria-label="ATLAS persistent navigation"');
    expect(shell).toContain('onClick={() => navigate(-1)}');
    expect(shell).toContain('onClick={() => navigate(1)}');
    expect(shell).toContain("onClick={() => navigate('/')}");
    expect(shell).toContain('aria-label="Back"');
    expect(shell).toContain('aria-label="Forward"');
    expect(shell).toContain('aria-label="Home"');
  });

  it('exposes the required breadcrumb hierarchy', () => {
    expect(shell).toContain('aria-label="ATLAS breadcrumb"');
    for (const level of ['menu', 'submenu', 'section', 'action-or-record']) {
      expect(shell).toContain(`level: '${level}'`);
    }
    expect(shell).toContain('data-breadcrumb-level={item.level}');
    expect(shell).toContain('aria-current="page"');
  });

  it('keeps the navigation context responsive on desktop, tablet and mobile', () => {
    expect(styles).toContain('.atlas-context-bar');
    expect(styles).toContain('@media(max-width:1024px)');
    expect(styles).toContain('@media(max-width:650px)');
    expect(styles).toContain('@media(max-width:420px)');
    expect(styles).toContain('.atlas-history-controls button span');
  });

  it('records shared UX evidence without claiming module-specific completion', () => {
    const evidence = acceptance.shared_ux_evidence;
    expect(evidence?.persistent_navigation.state).toBe('implemented');
    expect(evidence?.breadcrumbs.state).toBe('implemented');
    expect(evidence?.responsive_shell.state).toBe('implemented');
    expect(evidence?.unauthorized_gate.state).toBe('implemented');
    expect(acceptance).not.toHaveProperty('all_modules_final_verified');
  });
});
