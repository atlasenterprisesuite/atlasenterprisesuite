import type { TenantScope } from '../../core/src';

export type HealthSourceState = 'demo' | 'configured' | 'live' | 'unavailable';

export type HealthModuleId =
  | 'enterprise-os'
  | 'health-intelligence'
  | 'patient-experience'
  | 'clinical-operations'
  | 'finance-revenue'
  | 'hr-workforce'
  | 'smart-care'
  | 'pharmacy-4'
  | 'supply-chain'
  | 'ai-analytics'
  | 'research-innovation'
  | 'community-impact'
  | 'voice-assistant'
  | 'cleanscan-3d'
  | 'smart-facilities'
  | 'energy-sustainability'
  | 'safety-security'
  | 'public-health-watch';

export type HealthRecordBase = TenantScope & {
  id: string;
};
