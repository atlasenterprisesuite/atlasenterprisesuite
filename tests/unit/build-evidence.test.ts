import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectBuild } from '../../scripts/verify-build-evidence.mjs';

const sha = 'a'.repeat(40);
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-build-'));
  try {
    writeFileSync(join(dir, 'deployment.json'), JSON.stringify({commit_sha: sha, run_id: '42', service: 'atlas-enterprise-suite-web'}));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'hello');
    fn(dir);
  } finally { rmSync(dir, {recursive:true, force:true}); }
}
describe('ATLAS build evidence', () => {
  it('binds actual file bytes, manifest and checked-out SHA', () => fixture(dir => {
    const evidence = inspectBuild(dir, sha, '42');
    expect(evidence.commit_sha).toBe(sha);
    expect(evidence.files.map(f => f.path)).toEqual(['assets/app.js','deployment.json','index.html']);
    expect(evidence.files[0].sha256).toBe(createHash('sha256').update('hello').digest('hex'));
    writeFileSync(join(dir,'assets','app.js'),'changed');
    expect(inspectBuild(dir,sha,'42').tree_sha256).not.toBe(evidence.tree_sha256);
  }));
  it('rejects wrong SHA, run and missing entry point', () => fixture(dir => {
    expect(() => inspectBuild(dir,'b'.repeat(40),'42')).toThrow();
    expect(() => inspectBuild(dir,sha,'43')).toThrow();
    rmSync(join(dir,'index.html'));
    expect(() => inspectBuild(dir,sha,'42')).toThrow();
  }));
  it('rejects symbolic links rather than hashing external content', () => fixture(dir => {
    symlinkSync(join(dir,'index.html'),join(dir,'alias.html'));
    expect(() => inspectBuild(dir,sha,'42')).toThrow();
  }));
});
