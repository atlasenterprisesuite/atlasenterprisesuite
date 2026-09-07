export type ForgeRunStatus = 'queued' | 'assigned' | 'running' | 'passed' | 'failed' | 'cancelled' | 'timed_out' | 'infrastructure_error';
export type MirrorState = 'healthy' | 'syncing' | 'behind' | 'diverged' | 'authentication_required' | 'rate_limited' | 'unavailable';
export type ForgeStepDefinition = { readonly id: string; readonly command: string; readonly args: readonly string[]; readonly timeoutMs: number };
export type ForgePipelineDefinition = { readonly id: string; readonly version: number; readonly steps: readonly ForgeStepDefinition[]; readonly artifactPaths: readonly string[] };
export type ForgeStepResult = { readonly stepId: string; readonly status: 'passed' | 'failed' | 'timed_out' | 'infrastructure_error'; readonly exitCode: number | null; readonly startedAt: string; readonly finishedAt: string };
export type ForgeArtifactRecord = { readonly id: string; readonly sourceSha: string; readonly runId: string; readonly digest: string; readonly manifestPath: string; readonly payloadPath: string; readonly createdAt: string; readonly verified: boolean };
export type ForgeRunRecord = { readonly id: string; readonly repositoryId: string; readonly sourceSha: string; readonly pipelineId: string; readonly pipelineVersion: number; readonly trigger: 'manual' | 'push' | 'review' | 'retry'; readonly requestedBy: string; readonly correlationId: string; readonly createdAt: string; readonly startedAt: string | null; readonly finishedAt: string | null; readonly status: ForgeRunStatus; readonly artifact: ForgeArtifactRecord | null };
export type ForgeJobRecord = { readonly id: string; readonly runId: string; readonly repositoryId: string; readonly sourceSha: string; readonly pipeline: ForgePipelineDefinition; readonly createdAt: string; readonly status: ForgeRunStatus; readonly assignedRunnerId: string | null; readonly stepResults: readonly ForgeStepResult[] };

const allowed: Record<ForgeRunStatus, readonly ForgeRunStatus[]> = {
  queued: ['assigned', 'cancelled'], assigned: ['running', 'cancelled', 'infrastructure_error'],
  running: ['passed', 'failed', 'cancelled', 'timed_out', 'infrastructure_error'],
  passed: [], failed: [], cancelled: [], timed_out: [], infrastructure_error: [],
};
export function assertRunTransition(current: ForgeRunStatus, next: ForgeRunStatus): void {
  if (!allowed[current].includes(next)) throw new Error(`Invalid Forge run transition: ${current} -> ${next}`);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function safeRelativePath(value: string): boolean {
  if (!value || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) return false;
  return !value.replaceAll('\\', '/').split('/').includes('..');
}
export function parsePipeline(value: unknown): ForgePipelineDefinition {
  if (!isRecord(value)) throw new Error('Pipeline must be an object');
  const { id, version, steps, artifactPaths } = value;
  if (typeof id !== 'string' || !id.trim()) throw new Error('Pipeline id is required');
  if (!Number.isInteger(version) || Number(version) < 1) throw new Error('Pipeline version must be >= 1');
  if (!Array.isArray(steps)) throw new Error('Pipeline steps must be an array');
  if (!Array.isArray(artifactPaths)) throw new Error('Pipeline artifactPaths must be an array');
  const seen = new Set<string>();
  const parsedSteps = steps.map((raw): ForgeStepDefinition => {
    if (!isRecord(raw)) throw new Error('Pipeline step must be an object');
    const stepId = raw.id, command = raw.command, args = raw.args, timeoutMs = raw.timeoutMs;
    if (typeof stepId !== 'string' || !stepId.trim()) throw new Error('Step id is required');
    if (seen.has(stepId)) throw new Error(`Duplicate step id: ${stepId}`); seen.add(stepId);
    if (command !== 'npm') throw new Error(`Unsupported pipeline command: ${String(command)}`);
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) throw new Error('Step args must be strings');
    if (!Number.isInteger(timeoutMs) || Number(timeoutMs) < 1 || Number(timeoutMs) > 1_800_000) throw new Error('Step timeout must be between 1 and 1800000 ms');
    return { id: stepId, command, args: [...args] as string[], timeoutMs: Number(timeoutMs) };
  });
  const parsedArtifacts = artifactPaths.map((item) => {
    if (typeof item !== 'string' || !safeRelativePath(item)) throw new Error(`Unsafe artifact path: ${String(item)}`);
    return item.replaceAll('\\', '/');
  });
  return { id: id.trim(), version: Number(version), steps: parsedSteps, artifactPaths: parsedArtifacts };
}
