import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SYSTEM_ORDER = ['roots', 'trunk', 'brain', 'nerves', 'bark', 'senses'];
const root = process.cwd();

export function summarizeIntegrity(statuses) {
  const failed = SYSTEM_ORDER.filter((system) => statuses[system] !== true);
  return { healthy: failed.length === 0, failed };
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function includesAll(source, fragments) {
  return fragments.every((fragment) => source.includes(fragment));
}

function parseModules(registry) {
  const start = registry.indexOf('export const ATLAS_MODULES');
  const end = registry.indexOf('] as const;', start);
  if (start < 0 || end < 0) return [];
  const body = registry.slice(start, end);
  const modules = [];
  const pattern = /\{\s*id:\s*'([^']+)'[\s\S]*?route:\s*'([^']+)'[\s\S]*?readiness:\s*'([^']+)'[\s\S]*?requiresAuth:\s*(true|false)[\s\S]*?\}/g;
  for (const match of body.matchAll(pattern)) {
    modules.push({
      id: match[1],
      route: match[2],
      readiness: match[3],
      requiresAuth: match[4] === 'true',
    });
  }
  return modules;
}

function resolverBlock(source, route) {
  const routeIndex = source.indexOf(`'${route}'`);
  if (routeIndex < 0) return '';
  const blockStart = source.lastIndexOf('\n  if (', routeIndex);
  const nextBlock = source.indexOf('\n  if (', routeIndex + route.length + 2);
  return source.slice(Math.max(0, blockStart), nextBlock < 0 ? source.length : nextBlock);
}

function appRouteLine(source, routePrefix) {
  return source
    .split('\n')
    .find((line) => line.includes('<Route') && line.includes(`path="${routePrefix}`)) ?? '';
}

function moduleHasAuthCoverage(module, sources) {
  const { app, resolver, hospitality, ride, payroll, events, insurance } = sources;
  if (resolverBlock(resolver, module.route).includes('RequireAtlasIdentity')) return true;

  switch (module.id) {
    case 'hospitality':
      return hospitality.includes('RequireAtlasIdentity') && hospitality.includes(module.route);
    case 'ride':
      return ride.includes('RequireAtlasIdentity') && ride.includes(module.route);
    case 'payroll':
      return payroll.includes('RequireAtlasIdentity') && payroll.includes('<Routes>');
    case 'events':
      return events.includes('RequireAtlasIdentity') && events.includes(module.route);
    case 'insurance':
      return insurance.includes('RequireAtlasIdentity') && insurance.includes(module.route);
    case 'studio':
      return appRouteLine(app, '/studio"').includes('RequireAtlasIdentity');
    case 'voice':
      return appRouteLine(app, '/studio/voice').includes('RequireAtlasIdentity');
    case 'execution':
      return appRouteLine(app, '/execution/manager/readiness').includes('RequireAtlasIdentity');
    default:
      return false;
  }
}

export function evaluateNeuralIntegrity() {
  const migrationPath = 'supabase/migrations/20260916232000_atlas_orchestrator_persistence.sql';
  const migration = existsSync(resolve(root, migrationPath)) ? read(migrationPath) : '';
  const persistenceAdapter = read('packages/ai-core/src/supabasePersistence.ts');
  const aiIndex = read('packages/ai-core/src/index.ts');

  const roots = existsSync(resolve(root, migrationPath)) &&
    includesAll(migration, [
      'create table if not exists public.atlas_orchestrator_tasks',
      'create table if not exists public.atlas_orchestrator_events',
      'enable row level security',
      'revoke all on public.atlas_orchestrator_tasks from anon, authenticated',
      'revoke all on public.atlas_orchestrator_events from anon, authenticated',
    ]) &&
    includesAll(persistenceAdapter, ['class SupabasePersistence', 'readonly durable = true']) &&
    aiIndex.includes("export * from './supabasePersistence'");

  const main = read('apps/web/src/main.tsx');
  const registry = read('apps/web/src/modules/registry.ts');
  const appReturnCount = (main.match(/return <App \/>;/g) ?? []).length;
  const modules = parseModules(registry);
  const trunk = includesAll(main, [
    "location.pathname.startsWith('/hospitality')",
    "location.pathname.startsWith('/ride')",
  ]) &&
    appReturnCount === 1 &&
    !main.includes("location.pathname === '/voice'") &&
    modules.length > 0 &&
    includesAll(registry, ['route:', 'readiness:', 'requiresAuth:']);

  const persistenceResolver = read('apps/atlas-orchestrator/src/runtime/persistence.ts');
  const readiness = read('apps/atlas-orchestrator/src/runtime/readiness.ts');
  const http = read('apps/atlas-orchestrator/src/http.ts');
  const brain = includesAll(persistenceResolver, [
    'export function resolvePersistence',
    "ATLAS_PERSISTENCE_MODE === 'memory'",
    "ATLAS_PERSISTENCE_MODE !== 'supabase'",
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) &&
    includesAll(readiness, ['!persistence.durable', 'persistence_not_durable']) &&
    http.includes('createAtlasRuntime({ persistence: resolvePersistence(process.env) })');

  const app = read('apps/web/src/App.tsx');
  const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
  const hospitality = read('apps/web/src/modules/hospitality/HospitalityRoutes.tsx');
  const ride = read('apps/web/src/modules/ride/RideRoutes.tsx');
  const payroll = read('apps/web/src/modules/payroll/PayrollRoutes.tsx');
  const events = read('apps/web/src/modules/events/EventsRoutes.tsx');
  const insurance = read('apps/web/src/modules/insurance/InsuranceRoutes.tsx');
  const routeSources = [main, app, resolver, hospitality, ride, payroll, events, insurance].join('\n');
  const routesRepresented = modules.every((module) => routeSources.includes(module.route));
  const authCoverage = modules
    .filter((module) => module.requiresAuth)
    .every((module) => moduleHasAuthCoverage(module, { app, resolver, hospitality, ride, payroll, events, insurance }));
  const nerves = routesRepresented && authCoverage;

  const worker = read('worker/index.ts');
  const wrangler = read('wrangler.jsonc');
  const bark = includesAll(worker, [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-Atlas-Version-Id',
    'X-Atlas-Version-Tag',
    'env.ASSETS.fetch(request)',
  ]) &&
    includesAll(wrangler, [
      '"binding": "ASSETS"',
      '"binding": "CF_VERSION_METADATA"',
      '"run_worker_first": true',
      '"not_found_handling": "single-page-application"',
    ]);

  const workflow = read('.github/workflows/cloudflare-deploy.yml');
  const authorizedVerifier = read('supabase/functions/atlas-cloudflare-production-http-verify/index.ts');
  const senses = includesAll(workflow, [
    '--tag "$GITHUB_SHA"',
    'X-Atlas-Version-Id',
    'X-Atlas-Version-Tag',
    'OBSERVED_VERSION_ID',
    'OBSERVED_VERSION_TAG',
    'production_commit_sha_verified:process.env.PRODUCTION_COMMIT_SHA_VERIFIED===\'true\'',
    'AUTHORIZED_EDGE_VERIFIED',
    'Cloudflare deployment evidence recorded in Supabase ATLAS Manager.',
  ]) &&
    includesAll(authorizedVerifier, [
      "response.headers.get('x-atlas-version-id')",
      "response.headers.get('x-atlas-version-tag')",
      'observed_version_id',
      'observed_version_tag',
      'production_commit_sha_verified',
    ]);

  return { roots, trunk, brain, nerves, bark, senses };
}

function run() {
  const statuses = evaluateNeuralIntegrity();
  const summary = summarizeIntegrity(statuses);
  for (const system of SYSTEM_ORDER) {
    console.log(`ATLAS neural integrity ${system}=${statuses[system] ? 'PASS' : 'FAIL'}`);
  }
  if (!summary.healthy) {
    console.error(`ATLAS neural integrity failed systems: ${summary.failed.join(', ')}`);
    process.exitCode = 1;
  }
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invoked === import.meta.url) run();
