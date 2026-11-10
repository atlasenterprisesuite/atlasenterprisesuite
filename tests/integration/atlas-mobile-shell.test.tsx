import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellSource = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const cssSource = readFileSync('apps/web/src/modules/settings/mobileSettings.css', 'utf8');

describe('ATLAS mobile settings shell', () => {
  it('preserves accessible mobile drawer close behavior', () => {
    expect(shellSource).toContain("event.key === 'Escape'");
    expect(shellSource).toContain("window.matchMedia('(min-width: 1025px)')");
    expect(shellSource).toContain("document.body.style.overflow = 'hidden'");
    expect(shellSource).toContain('document.body.style.overflow = previousOverflow');
    expect(shellSource).toContain('onClick={closeMobileNav}');
  });

  it('exposes Settings from the canonical shell', () => {
    expect(shellSource).toContain('to="/settings/account"');
    expect(shellSource).toContain('<span>Settings</span>');
  });

  it('provides distinct phone and tablet settings layouts', () => {
    expect(cssSource).toContain('@media (max-width: 1024px)');
    expect(cssSource).toContain('@media (max-width: 720px)');
    expect(cssSource).toContain('.mobile-settings-nav');
  });
});
