import { healthSystemProfile } from './system';
import { commandCenterAlerts, commandCenterMetrics } from './commandCenter';
import { healthOperationalRecords } from './operations';

export * from './system';
export * from './commandCenter';
export * from './operations';

export const healthDemoData = {
  system: healthSystemProfile,
  metrics: commandCenterMetrics,
  alerts: commandCenterAlerts,
  operations: healthOperationalRecords
} as const;
