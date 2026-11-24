import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const identity = (row) => ({ version: row?.version, name: row?.name, sourceSha256: row?.sourceSha256 });
const duplicates = (rows) => [...new Set(rows.filter((row, index) => rows.findIndex((other) => other.version === row.version) !== index).map((row) => row.version))];
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const valid = (row) => typeof row.version === 'string' && /^\d{14}$/.test(row.version) && typeof row.name === 'string' && /^[a-zA-Z0-9_]+$/.test(row.name) && validHash(row.sourceSha256);

export function auditMigrationHistory(localRows, inventory, { projectId, now = new Date().toISOString() } = {}) {
  const local = Array.isArray(localRows) ? localRows.map(identity) : [];
  const remote = Array.isArray(inventory?.migrations) ? inventory.migrations.map(identity) : [];
  const errors = [];
  if (inventory?.schemaVersion !== 1) errors.push('unsupported_inventory_schema');
  if (!projectId || inventory?.projectId !== projectId) errors.push('project_mismatch');
  const ageMs = Date.parse(now) - Date.parse(inventory?.observedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) errors.push('inventory_not_fresh');
  if (!local.length || !remote.length) errors.push('empty_inventory');
  if (remote.some((row) => !valid(row))) errors.push('invalid_remote_evidence');
  if (duplicates(remote).length) errors.push('duplicate_remote_versions');
  const invalidLocalVersions = local.filter((row) => !valid(row));
  const duplicateLocalVersions = duplicates(local);
  const missingLocal = remote.filter((row) => !local.some((other) => other.version === row.version));
  const localNotRecorded = local.filter((row) => !remote.some((other) => other.version === row.version));
  const nameMismatch = [];
  const sourceMismatch = [];
  const bodyEquivalentCandidates = [];
  const differentBodyCandidates = [];
  for (const row of remote) {
    for (const other of local.filter((candidate) => candidate.version === row.version)) {
      if (other.name !== row.name) nameMismatch.push({ local: other, remote: row });
      if (other.sourceSha256 !== row.sourceSha256) sourceMismatch.push({ local: other, remote: row });
    }
  }
  for (const row of missingLocal) {
    for (const other of local.filter((candidate) => candidate.name === row.name && candidate.version !== row.version)) {
      const target = validHash(row.sourceSha256) && validHash(other.sourceSha256) && row.sourceSha256 === other.sourceSha256
        ? bodyEquivalentCandidates : differentBodyCandidates;
      target.push({ local: other, remote: row });
    }
  }
  const ok = ![errors, invalidLocalVersions, duplicateLocalVersions, missingLocal, localNotRecorded, nameMismatch, sourceMismatch].some((items) => items.length);
  return {
    schemaVersion: 1, mode: 'read-only', ok, status: ok ? 'snapshot-aligned' : 'blocked',
    liveVerified: false, databaseMutated: false, observedAt: inventory?.observedAt ?? null,
    projectId, localCount: local.length, remoteCount: remote.length,
    errors, invalidLocalVersions, duplicateLocalVersions, missingLocal, localNotRecorded,
    nameMismatch, sourceMismatch, bodyEquivalentCandidates, differentBodyCandidates,
    nextAction: ok ? 'Collect a fresh live inventory and verify isolated replay before deployment.'
      : 'Recover and compare historical source, resolve aliases and prove isolated replay. Do not repair history or replay production SQL from this report.'
  };
}

export function readLocalMigrationInventory(directory) {
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.sql')).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
    const match = entry.name.match(/^(\d+)_(.+)\.sql$/);
    return {
      version: match?.[1] ?? '', name: match?.[2] ?? '',
      sourceSha256: createHash('sha256').update(readFileSync(join(directory, entry.name), 'utf8').trim()).digest('hex')
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = {};
    for (let index = 2; index < process.argv.length; index += 2) {
      const flag = process.argv[index];
      if (!['--inventory', '--project-id', '--migrations', '--output'].includes(flag) || !process.argv[index + 1]) throw new Error('invalid_arguments');
      options[flag] = process.argv[index + 1];
    }
    if (!options['--inventory'] || !options['--project-id']) throw new Error('inventory_and_project_required');
    if (options['--output'] && resolve(options['--output']) === resolve(options['--inventory'])) throw new Error('output_would_overwrite_inventory');
    const inventory = JSON.parse(readFileSync(options['--inventory'], 'utf8'));
    const report = auditMigrationHistory(readLocalMigrationInventory(options['--migrations'] ?? 'supabase/migrations'), inventory, { projectId: options['--project-id'] });
    const json = JSON.stringify(report, null, 2) + '\n';
    if (options['--output']) writeFileSync(options['--output'], json);
    console.log(JSON.stringify({ status: report.status, local: report.localCount, remote: report.remoteCount, missingLocal: report.missingLocal.length, localNotRecorded: report.localNotRecorded.length, sourceMismatch: report.sourceMismatch.length, invalidLocalVersions: report.invalidLocalVersions.length, duplicateLocalVersions: report.duplicateLocalVersions, errors: report.errors }));
    process.exitCode = report.ok ? 0 : 1;
  } catch {
    console.error('Migration history audit failed: check arguments and inventory. No database operation was performed.');
    process.exitCode = 2;
  }
}
