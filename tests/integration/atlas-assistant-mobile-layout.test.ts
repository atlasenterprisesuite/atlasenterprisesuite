import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  resolve(process.cwd(), 'apps/web/src/components/assistant/assistant.css'),
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
      '.atlas-assistant-root{right:max(8px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom))}'
    );
  });
});
