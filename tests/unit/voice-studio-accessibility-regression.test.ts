import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Voice Studio shell and accessibility regressions', () => {
  it('uses the dedicated Voice Studio shell for both canonical entry routes', () => {
    const shell = source('apps/web/src/components/AtlasShell.tsx');
    expect(shell).toContain("location.pathname === '/voice/studio' || location.pathname === '/studio/voice'");
    expect(shell).toContain("'atlas-shell-voice-studio'");
  });

  it('keeps script-editor text sizing relative to the ATLAS accessibility scale', () => {
    const css = source('apps/web/src/modules/voice/voiceStudio.css');
    expect(css).toContain('studio-editor textarea{width:100%');
    expect(css).toContain('font-size:1.125em');
    expect(css).toContain('.studio-editor textarea{font-size:1em}');
    expect(css).not.toContain('.studio-editor textarea{font-size:18px}');
    expect(css).not.toContain('.studio-editor textarea{font-size:16px}');
  });
});
