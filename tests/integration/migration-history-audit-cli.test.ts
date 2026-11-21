import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe('migration audit CLI without database credentials', () => {
  it('returns success only for matching evidence, blocks drift and preserves the input', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-history-audit-'));
    try {
      mkdirSync(join(root, 'migrations'));
      const sql = 'select 1;';
      writeFileSync(join(root, 'migrations/20261111000000_example.sql'), sql);
      const inventory = join(root, 'inventory.json');
      const output = join(root, 'report.json');
      const payload = JSON.stringify({ schemaVersion: 1, projectId: 'test', observedAt: new Date().toISOString(), migrations: [{ version: '20261111000000', name: 'example', sourceSha256: createHash('sha256').update(sql).digest('hex') }] });
      writeFileSync(inventory, payload);
      const run = (path = output) => spawnSync(process.execPath, [resolve('scripts/audit-supabase-migration-history.mjs'), '--project-id', 'test', '--inventory', inventory, '--migrations', join(root, 'migrations'), '--output', path], { encoding: 'utf8' });
      expect(run().status).toBe(0);
      expect(JSON.parse(readFileSync(output, 'utf8')).liveVerified).toBe(false);
      writeFileSync(join(root, 'migrations/20261111000000_example.sql'), 'select 2;');
      expect(run().status).toBe(1);
      const report = JSON.parse(readFileSync(output, 'utf8'));
      expect(report.sourceMismatch).toHaveLength(1);
      expect(report.databaseMutated).toBe(false);
      expect(run(inventory).status).toBe(2);
      expect(readFileSync(inventory, 'utf8')).toBe(payload);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
