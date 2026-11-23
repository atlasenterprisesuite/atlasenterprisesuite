import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Native ESM script is exercised directly by Vitest.
import { inspectBuild } from '../../scripts/atlas-build-evidence.mjs';

describe('native build evidence', () => {
  it('measures only actual emitted JS and CSS and reports gzip bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-build-'));
    try {
      mkdirSync(join(root, 'assets'));
      writeFileSync(join(root, 'index.html'), '<html></html>');
      writeFileSync(join(root, 'assets', 'app.js'), 'const a = 1;');
      writeFileSync(join(root, 'assets', 'app.css'), 'body{}');
      const report = inspectBuild(root);
      expect(report.assets.map((a: {path:string}) => a.path)).toEqual(['assets/app.css','assets/app.js']);
      expect(report.assets[1].bytes).toBe(12);
      expect(report.assets[1].gzipBytes).toBeGreaterThan(0);
      expect(report.totalBytes).toBe(18);
    } finally { rmSync(root, {recursive:true,force:true}); }
  });
  it('fails closed when build output is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-build-'));
    try { expect(() => inspectBuild(root)).toThrow(/index.html/); }
    finally { rmSync(root, {recursive:true,force:true}); }
  });
});
