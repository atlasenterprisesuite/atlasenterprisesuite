import { ATLAS_MODULES } from '../modules/registry';

export type AtlasNavigationNode = {
  id: string;
  label: string;
  to: string;
  area: string;
  moduleId?: string;
  parentId?: string;
  match?: 'exact' | 'prefix' | 'pattern';
  keywords: readonly string[];
};

const STATIC_NODES: readonly AtlasNavigationNode[] = [
  { id: 'home', label: 'Home', to: '/', area: 'Platform', keywords: ['dashboard', 'inicio', 'main', 'principal'] },
  { id: 'suite', label: 'All Modules', to: '/suite', area: 'Platform', keywords: ['modules', 'modulos', 'suite', 'apps'] },
  { id: 'work-os', label: 'Work OS', to: '/work/os', area: 'Platform', moduleId: 'work', parentId: 'work', keywords: ['productivity', 'office', 'docs', 'sheets', 'present', 'mail', 'calendar', 'tasks', 'projects', 'forms', 'lists', 'notes', 'drive', 'meetings', 'automation', 'data fabric'] },
  { id: 'payables', label: 'Payables', to: '/finance/accounting/accounts-payable', area: 'Finance', moduleId: 'accounting', parentId: 'accounting', keywords: ['ap', 'accounts payable', 'cuentas por pagar', 'vendors', 'proveedores'] },
  { id: 'receivables', label: 'Receivables', to: '/finance/accounting/accounts-receivable', area: 'Finance', moduleId: 'accounting', parentId: 'accounting', keywords: ['ar', 'accounts receivable', 'cuentas por cobrar', 'customers', 'clientes'] },
  { id: 'enterprise-automation', label: 'Enterprise Automation', to: '/advisory/enterprise-automation', area: 'Business', moduleId: 'advisory', parentId: 'advisory', keywords: ['automation', 'automatizacion', '15 companies', 'roi', 'accounts payable', 'human resources', 'inventory', 'operations'] },
  { id: 'automotive-reporting', label: 'Automotive', to: '/finance/accounting/reports/automotive-sales', area: 'Finance', moduleId: 'accounting', parentId: 'accounting', keywords: ['automotive', 'dealer', 'vehicle', 'sales report', 'autos'] },
  { id: 'accessibility', label: 'Accessibility', to: '/settings/accessibility/communication', area: 'Platform', keywords: ['a11y', 'accessibility', 'accesibilidad', 'captions', 'screen reader', 'braille', 'sign language'] },
  { id: 'identity', label: 'Identity', to: '/identity', area: 'Platform', keywords: ['identity', 'login', 'signin', 'auth', 'identidad', 'acceso'] },
  { id: 'execution-workflow', label: 'Execution Workflow', to: '/execution/:workflowId', area: 'Platform', moduleId: 'execution', parentId: 'execution', match: 'pattern', keywords: ['workflow', 'execution', 'guided execution', 'flujo'] },
  { id: 'studio-create', label: 'Create', to: '/studio/create', area: 'Studio', moduleId: 'studio', parentId: 'studio', keywords: ['create', 'creator', 'crear', 'nuevo contenido'] },
  { id: 'studio-library', label: 'Library', to: '/studio/library', area: 'Studio', moduleId: 'studio', parentId: 'studio', keywords: ['library', 'assets', 'biblioteca', 'media'] },
  { id: 'studio-providers', label: 'Providers', to: '/studio/providers', area: 'Studio', moduleId: 'studio', parentId: 'studio', keywords: ['providers', 'models', 'proveedores', 'ai providers'] },
  { id: 'studio-voice', label: 'Voice', to: '/studio/voice', area: 'Studio', moduleId: 'studio', parentId: 'studio', keywords: ['voice', 'audio', 'voz', 'speech'] },
  { id: 'studio-teleprompter', label: 'Teleprompter', to: '/studio/teleprompter', area: 'Studio', moduleId: 'studio', parentId: 'studio', keywords: ['teleprompter', 'script', 'guion'] },
  { id: 'health-research', label: 'Research', to: '/health/research', area: 'Health', moduleId: 'health', parentId: 'health', keywords: ['research', 'investigacion', 'health research'] },
  { id: 'health-frontiers', label: 'Research Frontiers', to: '/health/research/frontiers', area: 'Health', moduleId: 'health', parentId: 'health-research', keywords: ['frontiers', 'diseases', 'evidence', 'falsification', 'research'] },
  { id: 'tax-namespace', label: 'Tax Workspace', to: '/tax/*', area: 'Finance', moduleId: 'tax', parentId: 'tax', match: 'prefix', keywords: ['tax', 'taxes', 'impuestos', 'returns'] },
  { id: 'payroll-namespace', label: 'Payroll Workspace', to: '/payroll/*', area: 'People', moduleId: 'payroll', parentId: 'payroll', match: 'prefix', keywords: ['payroll', 'nomina', 'employees', 'timesheets'] }
];

const MODULE_NODES: readonly AtlasNavigationNode[] = ATLAS_MODULES.map((module) => ({
  id: module.id,
  label: module.navLabel,
  to: module.route,
  area: module.area,
  moduleId: module.id,
  keywords: [
    module.title,
    module.description,
    module.area,
    module.id,
    module.navLabel
  ]
}));

export const ATLAS_NAVIGATION_GRAPH: readonly AtlasNavigationNode[] = [
  ...STATIC_NODES,
  ...MODULE_NODES
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
}

function scoreNode(node: AtlasNavigationNode, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const label = normalize(node.label);
  const route = normalize(node.to);
  const keywords = node.keywords.map(normalize);

  if (label === normalizedQuery) return 100;
  if (route === normalizedQuery) return 95;
  if (label.startsWith(normalizedQuery)) return 85;
  if (keywords.some((keyword) => keyword === normalizedQuery)) return 80;
  if (label.includes(normalizedQuery)) return 70;
  if (route.includes(normalizedQuery)) return 65;
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) return 60;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = [label, route, ...keywords].join(' ');
  const tokenMatches = queryTokens.filter((token) => haystack.includes(token)).length;
  return tokenMatches ? 30 + tokenMatches * 5 : 0;
}

export function searchAtlasNavigation(query: string, limit = 7) {
  return ATLAS_NAVIGATION_GRAPH
    .map((node) => ({ node, score: scoreNode(node, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label))
    .slice(0, limit)
    .map((entry) => entry.node);
}

function routePatternMatches(pattern: string, pathname: string) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((segment, index) => segment.startsWith(':') || segment === pathSegments[index]);
}

function nodeMatchesPath(node: AtlasNavigationNode, pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const route = node.to.replace(/\/+$/, '') || '/';
  const mode = node.match ?? 'exact';

  if (mode === 'pattern') return routePatternMatches(route, normalizedPath);
  if (mode === 'prefix') {
    const base = route.endsWith('/*') ? route.slice(0, -2) : route;
    return normalizedPath === base || normalizedPath.startsWith(base + '/');
  }
  return normalizedPath === route;
}

export function getAtlasNavigationNode(pathname: string) {
  return [...ATLAS_NAVIGATION_GRAPH]
    .sort((a, b) => b.to.length - a.to.length)
    .find((node) => nodeMatchesPath(node, pathname));
}

export function getAtlasNavigationTrail(pathname: string) {
  const node = getAtlasNavigationNode(pathname);
  if (!node) return [] as AtlasNavigationNode[];

  const trail: AtlasNavigationNode[] = [];
  const visited = new Set<string>();
  let current: AtlasNavigationNode | undefined = node;

  while (current && !visited.has(current.id)) {
    trail.unshift(current);
    visited.add(current.id);
    current = current.parentId
      ? ATLAS_NAVIGATION_GRAPH.find((candidate) => candidate.id === current?.parentId)
      : undefined;
  }

  if (trail[0]?.id !== 'home') {
    const home = ATLAS_NAVIGATION_GRAPH.find((candidate) => candidate.id === 'home');
    if (home) trail.unshift(home);
  }
  return trail;
}

export function getAtlasNavigationInstructions(pathname: string) {
  return getAtlasNavigationTrail(pathname).map((node) => node.label).join(' → ');
}

export function getAtlasRelatedNavigation(pathname: string, limit = 4) {
  const current = getAtlasNavigationNode(pathname);
  if (!current) return [] as AtlasNavigationNode[];

  return ATLAS_NAVIGATION_GRAPH
    .filter((node) => node.id !== current.id && node.area === current.area)
    .sort((a, b) => Number(Boolean(b.parentId)) - Number(Boolean(a.parentId)) || a.label.localeCompare(b.label))
    .slice(0, limit);
}
