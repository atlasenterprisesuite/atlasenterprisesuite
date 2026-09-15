import type { WorkExecutionMode } from './work-types';

export type ProviderExecutionCapability = {
  available: boolean;
  authorized: boolean;
  reason?: string;
};

export type ExecutionRouteRequest = {
  requestedMode: WorkExecutionMode;
  apiCapability: ProviderExecutionCapability;
  browserCapability: ProviderExecutionCapability;
  runtimeAvailable: boolean;
};

export type ExecutionRouteDecision = {
  state: 'ready' | 'blocked';
  mechanism: 'api' | 'browser' | null;
  reason: string;
};

function apiReady(capability: ProviderExecutionCapability) {
  return capability.available && capability.authorized;
}

function browserReady(capability: ProviderExecutionCapability, runtimeAvailable: boolean) {
  return capability.available && capability.authorized && runtimeAvailable;
}

export function selectExecutionRoute(request: ExecutionRouteRequest): ExecutionRouteDecision {
  const api = apiReady(request.apiCapability);
  const browser = browserReady(request.browserCapability, request.runtimeAvailable);

  if (request.requestedMode === 'api') {
    return api
      ? { state: 'ready', mechanism: 'api', reason: 'authorized_api_available' }
      : { state: 'blocked', mechanism: null, reason: 'authorized_api_unavailable' };
  }

  if (request.requestedMode === 'browser') {
    return browser
      ? { state: 'ready', mechanism: 'browser', reason: 'authorized_browser_runtime_available' }
      : { state: 'blocked', mechanism: null, reason: request.runtimeAvailable ? 'authorized_browser_unavailable' : 'browser_runtime_unavailable' };
  }

  if (api) return { state: 'ready', mechanism: 'api', reason: 'authorized_api_available' };
  if (browser) return { state: 'ready', mechanism: 'browser', reason: 'authorized_browser_runtime_available' };
  return { state: 'blocked', mechanism: null, reason: 'no_authorized_execution_path' };
}
