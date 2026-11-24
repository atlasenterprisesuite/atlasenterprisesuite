export type AtlasCapabilityOperation = 'read' | 'write' | 'execute' | 'stream';
export type AtlasCapabilityRiskTier = 'P0' | 'P1' | 'P2';
export type AtlasCapabilityRuntimeState =
  | 'declared'
  | 'implemented'
  | 'configured'
  | 'authorized'
  | 'verified'
  | 'degraded'
  | 'blocked'
  | 'unavailable';

export interface AtlasProviderBinding {
  provider: string;
  adapter: string;
  environments: string[];
  regions?: string[];
  priority: number;
  healthCheck: string;
  writePolicy?: string;
}

export interface AtlasCapabilityDefinition {
  id: string;
  version: number;
  domain: string;
  title: string;
  description: string;
  operation: AtlasCapabilityOperation;
  riskTier: AtlasCapabilityRiskTier;
  mutatesExternalState: boolean;
  mayIncurCost: boolean;
  requiresApproval: boolean;
  requiresEvidence: boolean;
  permissions: string[];
  allowedEnvironments: string[];
  inputSchemaRef: string;
  outputSchemaRef: string;
  providerBindings: AtlasProviderBinding[];
  verificationPolicy: string;
  skillRef?: string;
  guideRef?: string;
}
