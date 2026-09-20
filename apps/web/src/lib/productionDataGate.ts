export type ProductionDataGateState =
  | 'identity-required'
  | 'tenant-required'
  | 'permission-required'
  | 'source-required'
  | 'verification-required'
  | 'tenant-isolation-required'
  | 'stale'
  | 'production';

export interface ProductionDataGateInput {
  identity: boolean;
  activeTenant: boolean;
  authorized: boolean;
  sourceConnected: boolean;
  connectionVerified: boolean;
  tenantIsolated: boolean;
  fresh: boolean;
}

export interface ProductionDataGateResult {
  state: ProductionDataGateState;
  production: boolean;
  label: string;
}

const labels: Record<ProductionDataGateState, string> = {
  'identity-required': 'Identity required',
  'tenant-required': 'Active tenant required',
  'permission-required': 'Permission required',
  'source-required': 'Data source required',
  'verification-required': 'Connection verification required',
  'tenant-isolation-required': 'Tenant isolation verification required',
  stale: 'Data refresh required',
  production: 'LIVE / PRODUCTION'
};

export function evaluateProductionDataGate(input: ProductionDataGateInput): ProductionDataGateResult {
  const state: ProductionDataGateState =
    !input.identity ? 'identity-required' :
    !input.activeTenant ? 'tenant-required' :
    !input.authorized ? 'permission-required' :
    !input.sourceConnected ? 'source-required' :
    !input.connectionVerified ? 'verification-required' :
    !input.tenantIsolated ? 'tenant-isolation-required' :
    !input.fresh ? 'stale' :
    'production';

  return { state, production: state === 'production', label: labels[state] };
}

export function assertProductionData(result: ProductionDataGateResult): void {
  if (!result.production) throw new Error(`production_data_gate_failed:${result.state}`);
}
