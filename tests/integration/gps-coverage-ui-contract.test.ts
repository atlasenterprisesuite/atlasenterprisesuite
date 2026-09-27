import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const panel = readFileSync('apps/web/src/modules/gps/CoverageControlPanel.tsx', 'utf8');
const runner = readFileSync('apps/web/src/modules/gps/coverageRunner.ts', 'utf8');

describe('ATLAS GPS coverage UI integration', () => {
  it('mounts governed coverage controls in the GPS 4D surface', () => {
    expect(page).toContain("import { CoverageControlPanel } from './CoverageControlPanel'");
    expect(page).toContain('<CoverageControlPanel center={selected || current} />');
  });

  it('keeps batch execution bounded and resumable', () => {
    expect(runner).toContain('maxSectorsPerBatch');
    expect(runner).toContain('Math.min(25');
    expect(runner).toContain('saveGpsCoverageRun');
    expect(runner).toContain('restoreCoverageOrchestrator');
  });

  it('does not represent road geometry as street imagery', () => {
    expect(panel).toContain('No declara Street View');
    expect(runner).toContain('road-geometry coverage only; no street imagery claim');
  });
});
