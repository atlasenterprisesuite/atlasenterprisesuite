#!/usr/bin/env node
/**
 * Offline static preflight only. Never contacts Supabase, executes SQL, or
 * infers that migrations replay successfully in a clean database.
 *
 * Usage:
 *   node scripts/inspect-supabase-migration-source.mjs
 *   node scripts/inspect-supabase-migration-source.mjs --strict
 *   node scripts/inspect-supabase-migration-source.mjs --directory /path/to/migrations
 *
 * --strict fails for a demonstrably incomplete source (not a substitute for
 * clean isolated DB replay). Use normal mode for diagnostic evidence in CI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PREREQUISITES = [
  {
    name: 'public.identity_permissions',
    use: /\binsert\s+into\s+public\.identity_permissions\b/i,
    define: /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.identity_permissions\b/i
  },
  {
    name: 'public.identity_role_permissions',
    use: /\binsert\s+into\s+public\.identity_role_permissions\b/i,
    define: /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.identity_role_permissions\b/i
  },
  {
    name: 'public.organizations',
    use: /\breferences\s+public\.organizations\s*\(/i,
    define: /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.organizations\b/i
  },
  {
    name: 'public.has_identity_permission',
    use: /\bpublic\.has_identity_permission\s*\(/i,
    define: /\bcreate\s+(?:or\s+replace\s+)?function\s+public\.has_identity_permission\s*\(/i
  }
];

export function inspectMigrationSource(directory) {
  const filenames = readdirSync(directory)
    .filter(name => name.toLowerCase().endsWith('.sql'))
    .sort();
  const nonstandardFileNames = filenames.filter(name => !/^\d{14}_[a-z0-9_]+\.sql$/i.test(name));
  const missing = new Set();
  let precedingSQL = '';

  for (const filename of filenames) {
    const sql = readFileSync(resolve(directory, filename), 'utf8');
    for (const rule of PREREQUISITES) {
      const firstUse = rule.use.exec(sql);
      if (!firstUse) continue;
      const sqlBeforeUse = precedingSQL + '\n' + sql.slice(0, firstUse.index);
      if (!rule.define.test(sqlBeforeUse)) missing.add(rule.name);
    }
    precedingSQL += '\n' + sql;
  }

  const missingInitialPrerequisites = [...missing].sort();
  const sourceIncomplete = filenames.length === 0 || nonstandardFileNames.length > 0
    || missingInitialPrerequisites.length > 0;
  return {
    status: sourceIncomplete ? 'SOURCE_INCOMPLETE' : 'STATIC_PRECHECK_ONLY',
    migrationCount: filenames.length,
    earliestSourceFile: filenames[0] ?? null,
    nonstandardFileNames,
    missingInitialPrerequisites,
    sourceReplayVerified: false,
    productionVerified: false,
    notes: filenames.length === 0 ? ['No SQL migrations found'] : [
      'This is a conservative textual preflight; it cannot resolve SQL dependencies dynamically.',
      'Matching names or source syntax do not prove that the preview database replay succeeds.',
      'Do not change production migration history from this report.'
    ]
  };
}

function main() {
  const args = process.argv.slice(2);
  const directoryFlag = args.indexOf('--directory');
  if (directoryFlag !== -1 && !args[directoryFlag + 1]) {
    throw Error('--directory requires a folder argument');
  }
  const directory = directoryFlag < 0 ? resolve('supabase/migrations') : resolve(args[directoryFlag + 1]);
  const report = inspectMigrationSource(directory);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.status === 'SOURCE_INCOMPLETE') {
    process.stderr.write('ATLAS P0 diagnostic: standalone source replay prerequisites are incomplete. Preview status not tested.\n');
    if (args.includes('--strict')) process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
