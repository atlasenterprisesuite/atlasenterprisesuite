export const WORK_EXECUTION_MODES = ['api', 'browser', 'hybrid'] as const;
export type WorkExecutionMode = (typeof WORK_EXECUTION_MODES)[number];

export const WORK_AUTONOMY_LEVELS = ['manual', 'guided', 'autonomous'] as const;
export type WorkAutonomyLevel = (typeof WORK_AUTONOMY_LEVELS)[number];

export const WORK_RUNTIME_PREFERENCES = ['auto', 'local', 'self_hosted', 'cloud_ephemeral'] as const;
export type WorkRuntimePreference = (typeof WORK_RUNTIME_PREFERENCES)[number];

export type AtlasWorkContext = {
  executionMode: WorkExecutionMode;
  autonomyLevel: WorkAutonomyLevel;
  runtimePreference: WorkRuntimePreference;
  budgetLimit: number | null;
  connectionRefs: string[];
};

export function parseAtlasWorkContext(value: unknown): AtlasWorkContext {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const raw = root.work && typeof root.work === 'object' ? root.work as Record<string, unknown> : {};
  const executionMode = WORK_EXECUTION_MODES.includes(raw.executionMode as WorkExecutionMode)
    ? raw.executionMode as WorkExecutionMode
    : 'hybrid';
  const autonomyLevel = WORK_AUTONOMY_LEVELS.includes(raw.autonomyLevel as WorkAutonomyLevel)
    ? raw.autonomyLevel as WorkAutonomyLevel
    : 'guided';
  const runtimePreference = WORK_RUNTIME_PREFERENCES.includes(raw.runtimePreference as WorkRuntimePreference)
    ? raw.runtimePreference as WorkRuntimePreference
    : 'auto';
  const numericBudget = Number(raw.budgetLimit);
  const budgetLimit = raw.budgetLimit === null
    ? null
    : Number.isFinite(numericBudget) && numericBudget >= 0
      ? numericBudget
      : 0;

  return {
    executionMode,
    autonomyLevel,
    runtimePreference,
    budgetLimit,
    connectionRefs: Array.isArray(raw.connectionRefs)
      ? [...new Set(raw.connectionRefs.map(String).filter(Boolean))].slice(0, 20)
      : []
  };
}
