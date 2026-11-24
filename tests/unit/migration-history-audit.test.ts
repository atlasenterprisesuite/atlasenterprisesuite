import { describe, expect, it } from 'vitest';
import { auditMigrationHistory } from '../../scripts/audit-supabase-migration-history.mjs';

const row = { version: '20261111000000', name: 'example', sourceSha256: 'a'.repeat(64) };
const remote = { schemaVersion: 1, projectId: 'atlas-test', observedAt: '2026-11-11T22:00:00.000Z', migrations: [row] };
const now = '2026-11-11T23:00:00.000Z';
const check = (local = [row], inventory = remote) => auditMigrationHistory(local, inventory, { projectId: 'atlas-test', now });

describe('read-only migration history reconciliation', () => {
  it('accepts matching version, name and source evidence without claiming live verification', () => {
    const report = check();
    expect(report.ok).toBe(true);
    expect(report.liveVerified).toBe(false);
    expect(report.databaseMutated).toBe(false);
  });
  it('blocks missing remote history even when a local name and body match at another version', () => {
    const report = check([{ ...row, version: '20261111000001' }]);
    expect(report.ok).toBe(false);
    expect(report.missingLocal).toHaveLength(1);
    expect(report.localNotRecorded).toHaveLength(1);
    expect(report.bodyEquivalentCandidates).toHaveLength(1);
  });
  it('does not infer SQL equivalence from a matching name', () => {
    const report = check([{ ...row, version: '20261111000001', sourceSha256: 'b'.repeat(64) }]);
    expect(report.bodyEquivalentCandidates).toHaveLength(0);
    expect(report.differentBodyCandidates).toHaveLength(1);
    expect(report.ok).toBe(false);
  });
  it('blocks source differences at an existing version', () => {
    const report = check([{ ...row, sourceSha256: 'b'.repeat(64) }]);
    expect(report.sourceMismatch).toHaveLength(1);
    expect(report.ok).toBe(false);
  });
  it('blocks a different name at an existing version', () => {
    const report = check([{ ...row, name: 'other' }]);
    expect(report.nameMismatch).toHaveLength(1);
    expect(report.ok).toBe(false);
  });
  it('does not copy SQL, tokens or unknown fields into the output', () => {
    const report = check([{ ...row, token: 'private-token' } as typeof row], { ...remote, migrations: [{ ...row, statements: ['private-sql'] } as typeof row] });
    expect(JSON.stringify(report)).not.toMatch(/private-token|private-sql/);
  });
  it('detects duplicate version prefixes across different filenames', () => {
    const report = check([row, { ...row, name: 'other' }]);
    expect(report.duplicateLocalVersions).toEqual([row.version]);
    expect(report.ok).toBe(false);
  });
  it.each([
    { ...remote, migrations: [] },
    { ...remote, projectId: 'other-project' },
    { ...remote, observedAt: '2026-11-01T22:00:00.000Z' },
    { ...remote, observedAt: '2026-11-12T22:00:00.000Z' },
    { ...remote, migrations: [{ ...row, sourceSha256: '' }] },
    { ...remote, migrations: [row, row] }
  ])('fails closed on empty, wrong-project, stale, future or malformed evidence', (inventory) => {
    expect(check([row], inventory).ok).toBe(false);
  });
  it('rejects short local versions rather than silently trusting ambiguous dates', () => {
    expect(check([{ ...row, version: '20261111' }]).invalidLocalVersions).toHaveLength(1);
  });
});
