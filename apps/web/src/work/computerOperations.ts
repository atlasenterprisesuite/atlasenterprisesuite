import productionContractJson from '../../../../data/ops/global-production-verification.json';

export type ComputerOperationsRouteGroup = 'public' | 'work' | 'network';
export type ComputerOperationsProbeState = 'idle' | 'checking' | 'pass' | 'fail' | 'unavailable';

export type ComputerOperationsContract = {
  version: number;
  production_origin: string;
  default_mode: 'fail-closed' | 'warning-only';
  public_routes: string[];
  critical_network_routes: string[];
  protected_routes: Array<{
    path: string;
    allowed_statuses: number[];
  }>;
};

export type ComputerOperationsRoute = {
  path: string;
  group: ComputerOperationsRouteGroup;
};

export type ComputerOperationsProbe = ComputerOperationsRoute & {
  state: ComputerOperationsProbeState;
  status: number | null;
  durationMs: number | null;
  error: string | null;
};

export const COMPUTER_OPERATIONS_CONTRACT = productionContractJson as ComputerOperationsContract;

export function buildComputerOperationsRoutes(
  contract: ComputerOperationsContract = COMPUTER_OPERATIONS_CONTRACT
): ComputerOperationsRoute[] {
  const seen = new Set<string>();
  const routes: ComputerOperationsRoute[] = [];

  for (const path of contract.public_routes) {
    if (seen.has(path)) continue;
    seen.add(path);
    routes.push({
      path,
      group: path === '/work' || path.startsWith('/work/') ? 'work' : 'public'
    });
  }

  for (const path of contract.critical_network_routes) {
    if (seen.has(path)) continue;
    seen.add(path);
    routes.push({ path, group: 'network' });
  }

  return routes;
}

export function buildEssentialComputerOperationsRoutes(
  contract: ComputerOperationsContract = COMPUTER_OPERATIONS_CONTRACT
): ComputerOperationsRoute[] {
  return buildComputerOperationsRoutes(contract).filter(
    (route) => route.path === '/' || route.path === '/work' || route.group === 'network'
  );
}

export function browserProductionProbeSupported(
  currentOrigin: string,
  contract: ComputerOperationsContract = COMPUTER_OPERATIONS_CONTRACT
) {
  try {
    return new URL(currentOrigin).origin === new URL(contract.production_origin).origin;
  } catch {
    return false;
  }
}

export function idleComputerOperationsProbes(routes: ComputerOperationsRoute[]): ComputerOperationsProbe[] {
  return routes.map((route) => ({
    ...route,
    state: 'idle',
    status: null,
    durationMs: null,
    error: null
  }));
}

export async function probeComputerOperationsRoute(
  route: ComputerOperationsRoute,
  options: {
    fetchImpl?: typeof fetch;
    productionOrigin?: string;
  } = {}
): Promise<ComputerOperationsProbe> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const productionOrigin = options.productionOrigin ?? COMPUTER_OPERATIONS_CONTRACT.production_origin;
  const started = performance.now();

  try {
    const response = await fetchImpl(new URL(route.path, productionOrigin), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
      }
    });

    return {
      ...route,
      state: response.status === 200 ? 'pass' : 'fail',
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      error: response.status === 200 ? null : 'unexpected_http_status'
    };
  } catch {
    return {
      ...route,
      state: 'unavailable',
      status: null,
      durationMs: Math.round(performance.now() - started),
      error: 'browser_probe_unavailable'
    };
  }
}

export async function probeComputerOperationsRoutes(
  routes: ComputerOperationsRoute[],
  options: {
    fetchImpl?: typeof fetch;
    productionOrigin?: string;
  } = {}
): Promise<ComputerOperationsProbe[]> {
  return Promise.all(routes.map((route) => probeComputerOperationsRoute(route, options)));
}
