/** ATLAS 777: bounded, resumable, fail-closed orchestration. No live actions. */
const gated = new Set(['deploy', 'merge', 'trade', 'withdraw', 'connect_live', 'production_write', 'secrets']);
const allowed = new Set(['verify', 'audit', 'test', 'diagnose']);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(value);
const validCommitSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function validTask(task) {
  return task && safeId(task.id) && safeId(task.organizationId) && validCommitSha(task.sha) && safeId(task.kind)
    && safeId(task.idempotencyKey) && typeof task.approved === 'boolean';
}
export async function runAutonomousCycle({ tasks, execute, maxSteps = 20, organizationId, loadState, saveState }) {
  const completed = [];
  if (!Array.isArray(tasks) || typeof execute !== 'function' || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100
    || !safeId(organizationId) || typeof loadState !== 'function' || typeof saveState !== 'function')
    return { status: 'blocked', completed, reason: 'INVALID_CONFIGURATION' };
  const keys = new Set();
  for (const task of tasks) {
    if (!validTask(task) || task.organizationId !== organizationId)
      return { status: 'blocked', completed, reason: 'TENANT_OR_TASK_INVALID' };
    if (keys.has(task.idempotencyKey)) return { status: 'blocked', completed, reason: 'DUPLICATE_KEY' };
    keys.add(task.idempotencyKey);
  }
  for (const task of tasks) {
    if (completed.length >= maxSteps) return { status: 'paused', completed, reason: 'STEP_LIMIT' };
    if (task.approved !== true || gated.has(task.kind))
      return { status: 'authorization_required', completed, taskId: task.id, reason: 'HUMAN_GATE' };
    if (!allowed.has(task.kind)) return { status: 'blocked', completed, taskId: task.id, reason: 'UNSUPPORTED_ACTION' };
    let previous;
    try { previous = await loadState(organizationId, task.idempotencyKey); }
    catch { return { status: 'blocked', completed, taskId: task.id, reason: 'STATE_UNAVAILABLE' }; }
    if (previous) {
      if (previous.organizationId !== organizationId || previous.sha !== task.sha || previous.taskId !== task.id)
        return { status: 'blocked', completed, taskId: task.id, reason: 'STATE_CONFLICT' };
      if (previous.status === 'completed' && previous.evidence?.verified === true && previous.evidence?.sha === task.sha) {
        completed.push({ id: task.id, sha: task.sha, resumed: true });
        continue;
      }
      return { status: 'blocked', completed, taskId: task.id, reason: 'INCOMPLETE_STATE_REQUIRES_RECONCILIATION' };
    }
    // The state store MUST implement atomic create-if-absent, tenant isolation and durable writes.
    const pending = { organizationId, taskId: task.id, sha: task.sha, status: 'pending' };
    try {
      if (await saveState(organizationId, task.idempotencyKey, pending, { ifAbsent: true }) !== true)
        return { status: 'blocked', completed, taskId: task.id, reason: 'CONCURRENT_CLAIM' };
    } catch { return { status: 'blocked', completed, taskId: task.id, reason: 'STATE_UNAVAILABLE' }; }
    let result;
    try { result = await execute(Object.freeze({ ...task })); }
    catch { return { status: 'blocked', completed, taskId: task.id, reason: 'EXECUTION_FAILED' }; }
    if (result?.status !== 'completed' || result?.evidence?.verified !== true || result?.evidence?.sha !== task.sha)
      return { status: 'blocked', completed, taskId: task.id, reason: 'EVIDENCE_MISMATCH' };
    try {
      if (await saveState(organizationId, task.idempotencyKey, { ...pending, status: 'completed', evidence: result.evidence }, { expectedStatus: 'pending' }) !== true)
        return { status: 'blocked', completed, taskId: task.id, reason: 'PERSISTENCE_CONFLICT' };
    } catch { return { status: 'blocked', completed, taskId: task.id, reason: 'STATE_UNAVAILABLE' }; }
    completed.push({ id: task.id, sha: task.sha, resumed: false });
  }
  return { status: 'completed', completed };
}
