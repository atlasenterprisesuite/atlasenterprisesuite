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

export type HealthRecordBase = {
  id: string;
  tenantId: string;
  organizationId: string;
};

export type HealthOperationalRecord = HealthRecordBase & {
  moduleId: HealthModuleId;
  title: string;
  status: 'open' | 'active' | 'closed' | 'unavailable';
  category: string;
  sourceState: HealthSourceState;
  detail?: string;
};

export type HealthMetric = {
  id: string;
  moduleId: HealthModuleId;
  label: string;
  value: number;
  unit?: string;
  sourceState: HealthSourceState;
};

export type HealthAlert = HealthRecordBase & {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  moduleId: HealthModuleId;
  sourceState: HealthSourceState;
};
