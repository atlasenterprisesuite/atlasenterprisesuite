import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const errors = [];

const registry = read('apps/web/src/modules/registry.ts');
const app = read('apps/web/src/App.tsx');
const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
const cloudRoutes = read('apps/web/src/modules/cloud/AtlasCloudRoutes.tsx');
const cloudNav = read('apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx');
const voiceStudio = read('apps/web/src/modules/voice/VoiceStudioPage.tsx');
const voiceNarration = read('apps/web/src/modules/voice/AtlasVoiceNarration.tsx');
const suite = read('apps/web/src/modules/integration/AtlasSuitePage.tsx');

function fail(message) {
  errors.push(message);
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

const registryIds = [...registry.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
const registryRoutes = [...registry.matchAll(/\broute:\s*'([^']+)'/g)].map((match) => match[1]);

for (const id of duplicates(registryIds)) fail(`duplicate canonical module id: ${id}`);
for (const route of duplicates(registryRoutes)) fail(`duplicate canonical module route: ${route}`);

const appRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((route) => route.startsWith('/') && !route.includes(':') && !route.includes('*'));
const resolverRoutes = [...resolver.matchAll(/pathname\s*===\s*'([^']+)'/g)].map((match) => match[1]);

for (const route of appRoutes.filter((candidate) => resolverRoutes.includes(candidate))) {
  fail(`duplicate exact route ownership between App and extension resolver: ${route}`);
}

for (const legacy of [
  'function EnterpriseHome',
  'function BusinessHome',
  'function FinanceHome',
  'function AccountingHome',
  'function HealthHome'
]) {
  if (app.includes(legacy)) fail(`legacy duplicate module home reintroduced: ${legacy}`);
}

if (!app.includes('path="/settings/personalize"')) {
  fail('Personalize ATLAS route is missing from App');
}
if (!suite.includes('buildAtlasPortfolio')) {
  fail('ATLAS Suite is not consuming the canonical rebirth portfolio');
}
if (!cloudRoutes.includes("pathname === '/cloud/operations'")) {
  fail('Release & Operations convergence route is missing');
}
if (!cloudNav.includes('to="/cloud/operations">Release & Operations</Link>')) {
  fail('Cloud subnavigation is not converged on Release & Operations');
}
if (cloudNav.includes('>Releases</Link>') || cloudNav.includes('>Production Verify</Link>')) {
  fail('duplicate release entry points are visible in Cloud subnavigation');
}
if (!voiceStudio.includes("import { AtlasVoiceNarration } from './AtlasVoiceNarration';")) {
  fail('Voice Studio is not using the ATLAS-owned narration surface');
}
if (voiceStudio.includes("import { ElevenLabsNarration }")) {
  fail('provider-branded narration is exposed as the primary Voice Studio component');
}
if (!voiceNarration.includes('ATLAS Voice Narrator')) {
  fail('ATLAS Voice primary narration identity is missing');
}
if (voiceNarration.includes('<h2 id="atlas-voice-narration-heading">ElevenLabs')) {
  fail('external provider branding leaked into the primary Voice identity');
}
if (registry.includes('ATLAS Work Soberano')) {
  fail('legacy Work product naming remains in the canonical registry');
}

if (errors.length) {
  console.error('ATLAS Static Architecture Auditor failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `ATLAS Static Architecture Auditor passed: ${registryIds.length} canonical modules, `
  + `${registryRoutes.length} canonical routes, no exact App/resolver ownership conflicts.`
);
