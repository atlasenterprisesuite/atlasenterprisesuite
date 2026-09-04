import type { HealthModuleId, HealthSourceState } from '../../../packages/health/src';

export type HealthMetric = {
  id: string;
  moduleId: HealthModuleId;
  label: string;
  value: number;
  sourceState: HealthSourceState;
};

export type HealthAlert = {
  id: string;
  moduleId: HealthModuleId;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'closed';
  sourceState: HealthSourceState;
};

export const commandCenterMetrics: HealthMetric[] = [
  { id: 'm1', moduleId: 'patient-experience', label: 'Open experience queues', value: 7, sourceState: 'demo' },
  { id: 'm2', moduleId: 'clinical-operations', label: 'Operational queues', value: 5, sourceState: 'demo' },
  { id: 'm3', moduleId: 'smart-facilities', label: 'Open work orders', value: 4, sourceState: 'demo' },
  { id: 'm4', moduleId: 'supply-chain', label: 'Critical stock flags', value: 2, sourceState: 'demo' }
];

export const commandCenterAlerts: HealthAlert[] = [
  { id: 'a1', moduleId: 'smart-facilities', title: 'Facilities demo queue requires review', severity: 'warning', status: 'open', sourceState: 'demo' },
  { id: 'a2', moduleId: 'supply-chain', title: 'Supply demo threshold requires review', severity: 'warning', status: 'open', sourceState: 'demo' }
];
