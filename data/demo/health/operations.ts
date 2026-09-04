import type { HealthModuleId, HealthSourceState } from '../../../packages/health/src';

export type HealthOperationalRecord = {
  id: string;
  tenantId: string;
  organizationId: string;
  moduleId: HealthModuleId;
  title: string;
  status: 'open' | 'active' | 'closed' | 'unavailable';
  category: string;
  sourceState: HealthSourceState;
};

const scope = { tenantId: 'atlas-demo', organizationId: 'health-demo-org' } as const;

export const healthOperationalRecords: HealthOperationalRecord[] = [
  { ...scope, id: 'op-enterprise-1', moduleId: 'enterprise-os', title: 'Service line coordination review', status: 'active', category: 'operations', sourceState: 'demo' },
  { ...scope, id: 'op-intelligence-1', moduleId: 'health-intelligence', title: 'Governed intelligence view validation', status: 'open', category: 'analytics', sourceState: 'demo' },
  { ...scope, id: 'op-experience-1', moduleId: 'patient-experience', title: 'Experience queue workflow review', status: 'open', category: 'experience', sourceState: 'demo' },
  { ...scope, id: 'op-clinical-1', moduleId: 'clinical-operations', title: 'Throughput coordination queue', status: 'active', category: 'throughput', sourceState: 'demo' },
  { ...scope, id: 'op-finance-1', moduleId: 'finance-revenue', title: 'Revenue-cycle integration checkpoint', status: 'open', category: 'revenue-cycle', sourceState: 'demo' },
  { ...scope, id: 'op-workforce-1', moduleId: 'hr-workforce', title: 'Workforce coverage planning review', status: 'active', category: 'staffing', sourceState: 'demo' },
  { ...scope, id: 'op-smart-care-1', moduleId: 'smart-care', title: 'Remote-care orchestration configuration', status: 'open', category: 'virtual-care', sourceState: 'demo' },
  { ...scope, id: 'op-pharmacy-1', moduleId: 'pharmacy-4', title: 'Medication workflow checkpoint', status: 'active', category: 'pharmacy', sourceState: 'demo' },
  { ...scope, id: 'op-supply-1', moduleId: 'supply-chain', title: 'Critical stock demo threshold review', status: 'open', category: 'inventory', sourceState: 'demo' },
  { ...scope, id: 'op-ai-1', moduleId: 'ai-analytics', title: 'Model governance review queue', status: 'open', category: 'ai-governance', sourceState: 'demo' },
  { ...scope, id: 'op-community-1', moduleId: 'community-impact', title: 'Community program planning queue', status: 'active', category: 'community', sourceState: 'demo' },
  { ...scope, id: 'op-voice-1', moduleId: 'voice-assistant', title: 'Multilingual assistant configuration review', status: 'open', category: 'voice', sourceState: 'demo' },
  { ...scope, id: 'op-cleanscan-1', moduleId: 'cleanscan-3d', title: 'Facility scan intake review', status: 'active', category: 'spatial', sourceState: 'demo' },
  { ...scope, id: 'op-facilities-1', moduleId: 'smart-facilities', title: 'MRI cooling inspection', status: 'open', category: 'maintenance', sourceState: 'demo' },
  { ...scope, id: 'op-energy-1', moduleId: 'energy-sustainability', title: 'Resource-use target review', status: 'active', category: 'sustainability', sourceState: 'demo' },
  { ...scope, id: 'op-security-1', moduleId: 'safety-security', title: 'Access event review queue', status: 'open', category: 'security', sourceState: 'demo' },
  { ...scope, id: 'op-public-health-1', moduleId: 'public-health-watch', title: 'Public-health bulletin review', status: 'active', category: 'surveillance', sourceState: 'demo' }
];
