import type {
  AuditActionType,
  AuditLedgerEvent,
  AuditLedgerHead,
  AuditLedgerScope,
  AuditLedgerStore
} from '../../../packages/audit-ledger/src/types.ts';

type SupabaseLike = {
  from(table: string): any;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: any }>;
};

function mapEvent(row: any): AuditLedgerEvent {
  return {
    eventId: String(row.event_id),
    organizationId: String(row.org_id),
    tenantId: String(row.tenant_id),
    workflowId: String(row.workflow_id),
    taskId: String(row.task_id),
    actorId: String(row.actor_id),
    actionType: String(row.action_type) as AuditActionType,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    previousStateHash: String(row.previous_state_hash),
    nonce: String(row.nonce),
    digestVersion: 1,
    createdAt: String(row.created_at),
    payloadDigest: String(row.payload_digest)
  };
}

function mappedError(error: any): Error {
  const message = String(error?.message || error?.details || '');
  if (message.includes('audit_ledger_stale_head')) return new Error('audit_ledger_stale_head');
  if (message.includes('audit_ledger_invalid_scope')) return new Error('audit_ledger_invalid_scope');
  return new Error('audit_ledger_persistence_failed');
}

export class SupabaseAuditLedgerStore implements AuditLedgerStore {
  constructor(private readonly client: SupabaseLike) {}

  async readHead(scope: AuditLedgerScope): Promise<AuditLedgerHead | null> {
    const { data, error } = await this.client
      .from('audit_ledger_events')
      .select('event_id,payload_digest,created_at')
      .eq('org_id', scope.organizationId)
      .eq('tenant_id', scope.tenantId)
      .eq('workflow_id', scope.workflowId)
      .order('created_at', { ascending: false })
      .order('event_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('audit_ledger_read_failed');
    if (!data) return null;
    return {
      eventId: String(data.event_id),
      payloadDigest: String(data.payload_digest),
      createdAt: String(data.created_at)
    };
  }

  async readChain(scope: AuditLedgerScope): Promise<AuditLedgerEvent[]> {
    const { data, error } = await this.client
      .from('audit_ledger_events')
      .select('*')
      .eq('org_id', scope.organizationId)
      .eq('tenant_id', scope.tenantId)
      .eq('workflow_id', scope.workflowId)
      .order('created_at', { ascending: true })
      .order('event_id', { ascending: true });
    if (error) throw new Error('audit_ledger_read_failed');
    return (data || []).map(mapEvent);
  }

  async append(event: AuditLedgerEvent): Promise<AuditLedgerEvent> {
    const { error } = await this.client.rpc('append_audit_ledger_event', {
      p_event_id: event.eventId,
      p_org_id: event.organizationId,
      p_tenant_id: event.tenantId,
      p_workflow_id: event.workflowId,
      p_task_id: event.taskId,
      p_actor_id: event.actorId,
      p_action_type: event.actionType,
      p_payload_digest: event.payloadDigest,
      p_previous_state_hash: event.previousStateHash,
      p_metadata: event.metadata,
      p_nonce: event.nonce,
      p_digest_version: event.digestVersion,
      p_created_at: event.createdAt
    });
    if (error) throw mappedError(error);
    return event;
  }
}
