import { healthAlerts, healthIntegrations, commandCenterMetrics } from './commandCenter';
import { healthOperations } from './operations';
import { healthSystemProfile } from './system';

export { healthSystemProfile, commandCenterMetrics, healthAlerts, healthIntegrations, healthOperations };

export const healthDemoData = {
  system: healthSystemProfile,
  metrics: commandCenterMetrics,
  alerts: healthAlerts,
  integrations: healthIntegrations,
  operations: healthOperations
};
