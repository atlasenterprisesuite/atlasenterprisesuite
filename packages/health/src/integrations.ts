import type { HealthSourceState } from './types';

export type HealthIntegrationKind =
  | 'fhir'
  | 'hl7v2'
  | 'ehr'
  | 'finance'
  | 'workforce'
  | 'pharmacy'
  | 'facilities-iot'
  | 'voice'
  | 'public-health';

export type HealthIntegration = {
  id: string;
  kind: HealthIntegrationKind;
  name: string;
  state: HealthSourceState;
  lastHealthCheckAt: string | null;
  authorized: boolean;
};

export function validateIntegration(integration: HealthIntegration) {
  if (integration.state !== 'live') return true;
  return integration.authorized && integration.lastHealthCheckAt !== null;
}
