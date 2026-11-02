import type { RoboticsRunStore } from './simulation-adapter';

/**
 * Server-only bridge to an authenticated, scoped transaction executor.
 * This module deliberately has no network endpoint, credentials, or browser fallback.
 * A trusted service must bind actor identity and enforce membership before invoking SQL.
 */
export type RoboticsCommand = 'reserve' | 'complete' | 'halt' | 'isHalted';
export type RoboticsTransaction = (input: {
  command: RoboticsCommand;
  tenantId: string;
  organizationId: string;
  runId: string;
}) => Promise<boolean>;

export function createPersistentRoboticsRunStore(transaction: RoboticsTransaction): RoboticsRunStore {
  const invoke = async (command: RoboticsCommand, scope: { tenantId: string; organizationId: string }, runId: string) => {
    if (!scope.tenantId || !scope.organizationId || !/^[A-Za-z0-9_-]{1,128}$/.test(runId)) {
      throw new Error('invalid_robotics_scope');
    }
    return transaction({ command, tenantId: scope.tenantId, organizationId: scope.organizationId, runId });
  };
  return {
    reserve: (scope, runId) => invoke('reserve', scope, runId),
    complete: async (scope, runId) => {
      if (!await invoke('complete', scope, runId)) throw new Error('robotics_complete_denied');
    },
    halt: async (scope, runId) => {
      if (!await invoke('halt', scope, runId)) throw new Error('robotics_halt_denied');
    },
    isHalted: (scope, runId) => invoke('isHalted', scope, runId)
  };
}
