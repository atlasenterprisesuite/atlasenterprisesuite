/** Bounded, fail-closed orchestration kernel. No provider calls or deployments. */
const gated = new Set(['deploy', 'merge', 'trade', 'withdraw', 'connect_live', 'production_write', 'secrets']);
export async function runAutonomousCycle({ tasks, execute, maxSteps = 20 }) {
  if (!Array.isArray(tasks) || typeof execute !== 'function' || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100)
    return { status: 'blocked', completed: [], reason: 'INVALID_CONFIGURATION' };
  const completed = [];
  for (const task of tasks) {
    if (completed.length >= maxSteps) return { status: 'paused', completed, reason: 'STEP_LIMIT' };
    if (!task || typeof task.id !== 'string' || !task.id || typeof task.sha !== 'string' || !task.sha)
      return { status: 'blocked', completed, reason: 'INVALID_TASK' };
    if (task.approved !== true || gated.has(task.kind))
      return { status: 'authorization_required', completed, taskId: task.id, reason: 'HUMAN_GATE' };
    if (!['verify', 'audit', 'test', 'diagnose'].includes(task.kind))
      return { status: 'blocked', completed, taskId: task.id, reason: 'UNSUPPORTED_ACTION' };
    let result;
    try { result = await execute(Object.freeze({ ...task })); }
    catch { return { status: 'blocked', completed, taskId: task.id, reason: 'EXECUTION_FAILED' }; }
    if (result?.status !== 'completed' || result?.evidence?.verified !== true || result?.evidence?.sha !== task.sha)
      return { status: 'blocked', completed, taskId: task.id, reason: 'EVIDENCE_MISMATCH' };
    completed.push({ id: task.id, sha: task.sha });
  }
  return { status: 'completed', completed };
}
