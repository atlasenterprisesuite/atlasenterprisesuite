import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const tokens = readFileSync('apps/web/src/atlas-design-tokens.css', 'utf8');
const styles = readFileSync('apps/web/src/styles.css', 'utf8');

describe('ATLAS shell navigation and legibility contract', () => {
  it('groups modules into accessible expandable navigation domains', () => {
    expect(shell).toContain('ATLAS_MODULES');
    expect(shell).toContain('atlas-nav-group');
    expect(shell).toContain('<summary');
    expect(shell).toContain('open={groupActive || undefined}');
    expect(shell).toContain('aria-label="ATLAS modules"');
  });

  it('defines readable typography and control sizing tokens', () => {
    expect(tokens).toContain('--atlas-font-size-xs: 0.75rem;');
    expect(tokens).toContain('--atlas-font-size-sm: 0.8125rem;');
    expect(tokens).toContain('--atlas-line-height-ui: 1.4;');
    expect(tokens).toContain('--atlas-control-height: 44px;');
    expect(tokens).toContain('--atlas-card-min-height: 96px;');
  });

  it('applies the shell legibility and submenu interaction layer', () => {
    expect(styles).toContain('ATLAS shell legibility + navigation hierarchy');
    expect(styles).toContain('.atlas-nav-group-summary');
    expect(styles).toContain('font-size:var(--atlas-font-size-sm)');
    expect(styles).toContain('min-height:var(--atlas-control-height)');
  });
});
