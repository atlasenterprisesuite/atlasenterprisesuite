/** ATLAS multi-agent contract: no provider execution is inferred from a task receipt. */
export type AtlasAgent = 'openai' | 'manus' | 'copilot';
export type AtlasAgentStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'blocked';
export type AtlasAgentTask = Readonly<{
  taskId: string;
  tenantId: string;
  organizationId: string;
  agent: AtlasAgent;
  goal: string;
  idempotencyKey: string;
  requiresApproval: boolean;
}>;
export type AtlasAgentReceipt = Readonly<{
  taskId: string;
  tenantId: string;
  organizationId: string;
  agent: AtlasAgent;
  status: AtlasAgentStatus;
  evidenceRefs: readonly string[];
  providerExecutionId?: string;
  reason?: string;
}>;
export type AtlasAgentExecutionContext = Readonly<{
  tenantId: string;
  organizationId: string;
  authorized: boolean;
  approved: boolean;
  providerEnabled: boolean;
}>;
export function validateAgentTask(task: AtlasAgentTask): void {
  if (!task.taskId.trim() || !task.tenantId.trim() || !task.organizationId.trim() || !task.goal.trim() || !task.idempotencyKey.trim()) throw new Error('invalid_task');
}
export function evaluateAgentDispatch(task: AtlasAgentTask, context: AtlasAgentExecutionContext): AtlasAgentReceipt {
  validateAgentTask(task);
  const base = { taskId: task.taskId, tenantId: task.tenantId, organizationId: task.organizationId, agent: task.agent, evidenceRefs: [] as string[] };
  if (!context.authorized || task.tenantId !== context.tenantId || task.organizationId !== context.organizationId) return { ...base, status: 'blocked', reason: 'scope_or_authorization_denied' };
  if (task.requiresApproval && !context.approved) return { ...base, status: 'waiting_approval', reason: 'human_approval_required' };
  if (!context.providerEnabled) return { ...base, status: 'blocked', reason: 'provider_not_connected' };
  return { ...base, status: 'queued' };
}
export function verifyAgentCompletion(receipt: AtlasAgentReceipt): boolean {
  return receipt.status === 'completed' && Boolean(receipt.providerExecutionId?.trim()) && receipt.evidenceRefs.length > 0 && receipt.evidenceRefs.every(ref => ref.trim().length > 0);
}
export function rejectDuplicateTask(previous: AtlasAgentTask, incoming: AtlasAgentTask): void {
  if (previous.tenantId === incoming.tenantId && previous.organizationId === incoming.organizationId && previous.idempotencyKey === incoming.idempotencyKey) throw new Error('duplicate_idempotency_key');
}
