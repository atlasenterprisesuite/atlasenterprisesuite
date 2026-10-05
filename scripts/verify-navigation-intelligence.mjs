import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function extractModuleEntries(source) {
  const start = source.indexOf('export const ATLAS_MODULES');
  const end = source.indexOf('] as const;', start);
  if (start < 0 || end < 0) return [];
  const body = source.slice(start, end);
  const entries = [];
  const pattern = /\{\s*id:\s*'([^']+)'[\s\S]*?route:\s*'([^']+)'[\s\S]*?showInNavigation:\s*(true|false)[\s\S]*?\}/g;
  for (const match of body.matchAll(pattern)) {
    entries.push({ id: match[1], route: match[2], showInNavigation: match[3] === 'true' });
  }
  return entries;
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

function routePath(route) {
  return route.split(/[?#]/, 1)[0] || '/';
}

function routeExists(route, sources) {
  const path = routePath(route);
  return sources.some((source) =>
    source.includes(`path="${path}"`) ||
    source.includes(`path="${path}/*"`) ||
    source.includes(`pathname === '${path}'`) ||
    source.includes(`pathname.startsWith('${path}')`) ||
    source.includes(`route: '${path}'`) ||
    source.includes(`to: '${path}'`)
  );
}

function extractAIWorkspaceIds(navigation) {
  const start = navigation.indexOf('export const ATLAS_AI_WORKSPACE_NODE_IDS');
  const end = navigation.indexOf('] as const;', start);
  if (start < 0 || end < 0) return [];
  return [...navigation.slice(start, end).matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

export function evaluateNavigationIntelligence() {
  const registry = read('apps/web/src/modules/registry.ts');
  const navigation = read('apps/web/src/navigation/atlasNavigation.ts');
  const shell = read('apps/web/src/components/AtlasShell.tsx');
  const routeContext = read('apps/web/src/assistant/routeContext.ts');
  const app = read('apps/web/src/App.tsx');
  const resolver = read('apps/web/src/extensions/resolveAtlasExtension.tsx');
  const modules = extractModuleEntries(registry);
  const aiWorkspaceIds = extractAIWorkspaceIds(navigation);
  const expectedAIWorkspaceIds = [
    'assistant',
    'work',
    'studio',
    'ai-universe',
    'studio-create',
    'creator-library',
    'provider-readiness',
    'voice'
  ];
  const aiWorkspaceRoutes = [
    '/assistant',
    '/work',
    '/studio',
    '/studio/ai-universe',
    '/studio/create',
    '/studio/library',
    '/studio/providers',
    '/voice',
    '/studio/voice'
  ];
  const laterWaveIds = [
    'projects',
    'research',
    'skills',
    'agents',
    'canvas',
    'notebooks',
    'pages',
    'apps',
    'scheduled',
    'vision',
    'developer'
  ];

  const moduleIdsUnique = duplicates(modules.map((module) => module.id)).length === 0;
  const moduleRoutesUnique = duplicates(modules.map((module) => module.route)).length === 0;
  const canonicalGraph = navigation.includes("import { ATLAS_MODULES } from '../modules/registry'") &&
    navigation.includes('ATLAS_NAVIGATION_GRAPH') &&
    navigation.includes('searchAtlasNavigation') &&
    navigation.includes('getAtlasNavigationTrail') &&
    navigation.includes('getAtlasNavigationInstructions');
  const searchUsesGraph = shell.includes("import { searchAtlasNavigation } from '../navigation/atlasNavigation'") &&
    shell.includes('searchAtlasNavigation(searchQuery)');
  const assistantUsesGraph = routeContext.includes("import { getAtlasNavigationNode } from '../navigation/atlasNavigation'") &&
    routeContext.includes('getAtlasNavigationNode(pathname)');
  const representedRoutes = modules.every((module) => routeExists(module.route, [app, resolver, registry]));
  const gpsCanonical = modules.some((module) => module.id === 'gps' && module.route === '/gps' && module.showInNavigation) &&
    app.includes('path="/gps"');
  const failClosedUnknown = navigation.includes("if (!node) return [] as AtlasNavigationNode[];") &&
    navigation.includes('return trail;');
  const aiWorkspaceDerivedFromCanonicalGraph = navigation.includes('export const ATLAS_AI_WORKSPACE_NAVIGATION') &&
    navigation.includes('ATLAS_AI_WORKSPACE_NODE_IDS.flatMap') &&
    navigation.includes('ATLAS_NAVIGATION_GRAPH.find((candidate) => candidate.id === id)');
  const aiWorkspaceNodeIdsComplete = expectedAIWorkspaceIds.every((id) => aiWorkspaceIds.includes(id)) &&
    aiWorkspaceIds.length === expectedAIWorkspaceIds.length;
  const aiWorkspaceDestinationsRepresented = aiWorkspaceRoutes.every((route) =>
    routeExists(route, [app, resolver, registry, navigation])
  );
  const aiWorkspaceLaterWavesAbsent = laterWaveIds.every((id) => !aiWorkspaceIds.includes(id));
  const aiWorkspaceAliasesFailClosed = navigation.includes('aliases?: readonly string[]') &&
    navigation.includes('normalizeAtlasPath') &&
    navigation.includes('node.aliases?.some') &&
    !navigation.includes('normalizedPath.startsWith(alias') &&
    !navigation.includes('pathname.startsWith(alias');

  return {
    moduleIdsUnique,
    moduleRoutesUnique,
    canonicalGraph,
    searchUsesGraph,
    assistantUsesGraph,
    representedRoutes,
    gpsCanonical,
    failClosedUnknown,
    aiWorkspaceDerivedFromCanonicalGraph,
    aiWorkspaceNodeIdsComplete,
    aiWorkspaceDestinationsRepresented,
    aiWorkspaceLaterWavesAbsent,
    aiWorkspaceAliasesFailClosed
  };
}

function run() {
  const status = evaluateNavigationIntelligence();
  const failed = Object.entries(status).filter(([, value]) => !value).map(([key]) => key);
  for (const [key, value] of Object.entries(status)) {
    console.log(`ATLAS navigation intelligence ${key}=${value ? 'PASS' : 'FAIL'}`);
  }
  if (failed.length) {
    console.error(`ATLAS navigation intelligence failed checks: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

run();