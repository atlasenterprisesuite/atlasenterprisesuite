import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  resolve(process.cwd(), 'apps/web/src/components/assistant/assistant.css'),
  'utf8'
);
const shell = readFileSync(
  resolve(process.cwd(), 'apps/web/src/components/AtlasShell.tsx'),
  'utf8'
);
const accessibilityStyles = readFileSync(
  resolve(process.cwd(), 'apps/web/src/accessibility.css'),
  'utf8'
);
const unifiedAiStyles = readFileSync(
  resolve(process.cwd(), 'apps/web/src/modules/intelligence/UnifiedAIChat.css'),
  'utf8'
);

describe('ATLAS Assistant mobile layout', () => {
  it('keeps the desktop launcher prominent while reducing mobile content obstruction', () => {
    expect(styles).toContain('.atlas-assistant-launcher{position:relative;width:76px;height:76px');
    expect(styles).toContain('@media(max-width:760px)');
    expect(styles).toContain('.atlas-assistant-launcher{width:52px;height:52px;border-radius:16px}');
    expect(styles).toContain('.atlas-assistant-launcher img{border-radius:15px}');
    expect(styles).toContain('.atlas-assistant-launcher-status{right:-1px;bottom:-1px;width:14px;height:14px}');
  });

  it('retains safe-area-aware mobile placement', () => {
    expect(styles).toContain(
      '.atlas-assistant-root{right:max(8px,env(safe-area-inset-right));bottom:calc(76px + env(safe-area-inset-bottom))}'
    );
  });

  it('does not stack the floating assistant on the dedicated assistant workspace', () => {
    expect(shell).toContain("location.pathname === '/assistant'");
    expect(shell).toContain("location.pathname.startsWith('/assistant/')");
    expect(shell).toContain('!routeOwnsAssistantSurface ? <AtlasAssistant /> : null');
  });

  it('keeps mobile global controls from obscuring the assistant composer', () => {
    expect(accessibilityStyles).toContain('width: 44px;');
    expect(accessibilityStyles).toContain('.atlas-accessibility-launcher > span:last-child { display: none; }');
    expect(accessibilityStyles).toContain('bottom: calc(12px + env(safe-area-inset-bottom));');
    expect(unifiedAiStyles).toContain('width:calc(100% - 20px);');
    expect(unifiedAiStyles).toContain('max-height:min(62dvh,560px);');
    expect(unifiedAiStyles).not.toContain('width:calc(100vw - 20px);');
  });
});
