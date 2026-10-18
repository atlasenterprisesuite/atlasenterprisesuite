import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('apps/web/src/modules/gps/CoverageControlPanel.tsx', 'utf8');

describe('ATLAS GPS coverage live progress UI', () => {
  it('polls persisted coverage while the page is visible', () => {
    expect(panel).toContain('window.setInterval');
    expect(panel).toContain('document.visibilityState');
    expect(panel).toContain('refresh(true)');
    expect(panel).toContain('5000');
  });

  it('shows the most recent synchronization time', () => {
    expect(panel).toContain('lastSyncedAt');
    expect(panel).toContain('Sincronización');
    expect(panel).toContain('toLocaleTimeString');
  });
});
