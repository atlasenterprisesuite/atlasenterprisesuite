import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const functionsRoot = join(root, 'supabase', 'functions');
const migrationsRoot = join(root, 'supabase', 'migrations');

function fail(message) {
  console.error(`[verify:edge] ${message}`);
  process.exitCode = 1;
}

if (!existsSync(functionsRoot)) fail('supabase/functions is missing');
if (!existsSync(migrationsRoot)) fail('supabase/migrations is missing');

if (existsSync(functionsRoot)) {
  const functionDirs = readdirSync(functionsRoot)
    .map((name) => join(functionsRoot, name))
    .filter((path) => statSync(path).isDirectory());

  if (functionDirs.length === 0) fail('no Supabase Edge Function directories were found');

  for (const dir of functionDirs) {
    const entries = ['index.ts', 'index.mjs', 'index.js'];
    if (!entries.some((name) => existsSync(join(dir, name)))) {
      fail(`${dir.replace(`${root}/`, '')} has no index.ts/index.mjs/index.js entrypoint`);
    }
  }
}

if (existsSync(migrationsRoot)) {
  const migrations = readdirSync(migrationsRoot).filter((name) => name.endsWith('.sql'));
  if (migrations.length === 0) fail('no Supabase SQL migrations were found');
  const duplicates = migrations.filter((name, index) => migrations.indexOf(name) !== index);
  if (duplicates.length) fail(`duplicate migration filenames: ${[...new Set(duplicates)].join(', ')}`);

  for (const name of migrations) {
    const body = readFileSync(join(migrationsRoot, name), 'utf8');
    if (!body.trim()) fail(`migration ${name} is empty`);
  }
}

if (!process.exitCode) console.log('[verify:edge] Supabase function entrypoints and migrations verified.');
