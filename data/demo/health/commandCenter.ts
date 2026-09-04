import type { HealthAlert, HealthMetric } from '../../../packages/health/src';
import type { HealthIntegration } from '../../../packages/health/src/integrations';

export const commandCenterMetrics: HealthMetric[] = [
  { id: 'm1', moduleId: 'patient-experience', label: 'Open experience queues', value: 7, sourceState: 'demo' },
  { id: 'm2', moduleId: 'clinical-operations', label: 'Operational queues', value: 5, sourceState: 'demo' },
  { id: 'm3', moduleId: 'smart-facilities', label: 'Open work orders', value: 4, sourceState: 'demo' },
  { id: 'm4', moduleId: 'supply-chain', label: 'Critical stock flags', value: 2, sourceState: 'demo' }
];

export const healthAlerts: HealthAlert[] = [
  { id: 'alert-1', tenantId: 'atlas-demo', organizationId: 'health-demo-org', severity: 'warning', title: 'Demo supply stock threshold review', moduleId: 'supply-chain', sourceState: 'demo' },
  { id: 'alert-2', tenantId: 'atlas-demo', organizationId: 'health-demo-org', severity: 'info', title: 'Demo facilities work-order review', moduleId: 'smart-facilities', sourceState: 'demo' }
];

export const healthIntegrations: HealthIntegration[] = [
  { id: 'fhir-demo', kind: 'fhir', name: 'FHIR connector', state: 'configured', lastHealthCheckAt: null, authorized: false },
  { id: 'finance-demo', kind: 'finance', name: 'ATLAS Accounting bridge', state: 'configured', lastHealthCheckAt: null, authorized: true },
  { id: 'workforce-demo', kind: 'workforce', name: 'Workforce bridge', state: 'unavailable', lastHealthCheckAt: null, authorized: false },
  { id: 'facilities-demo', kind: 'facilities-iot', name: 'Facilities IoT', state: 'unavailable', lastHealthCheckAt: null, authorized: false },
  { id: 'voice-demo', kind: 'voice', name: 'ATLAS Voice runtime', state: 'unavailable', lastHealthCheckAt: null, authorized: false },
  { id: 'public-health-demo', kind: 'public-health', name: 'Public health feed', state: 'unavailable', lastHealthCheckAt: null, authorized: false }
];
