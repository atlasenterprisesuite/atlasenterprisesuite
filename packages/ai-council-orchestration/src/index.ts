import {
  createCouncilEvidence,
  evaluateCouncilConsensus,
  transitionCouncilTask,
  type CouncilEvidenceRecord,
  type CouncilProviderAdapter,
  type CouncilProviderOutcome,
  type CouncilResponseEnvelope,
  type CouncilTask,
} from '../../ai-council-core/src';
import {
  sameScope,
  type AuditEvent,
  type AuditSink,
  type TenantScope,
} from '../../core/src';

export type CouncilProviderExecution = Readonly<{
  executionId: string;
  provider: string;
  status: 'completed' | 'failed';
  response?: CouncilResponseEnvelope;
  evidenceId?: string;
  errorClass?: 'provider_error';
}>;

export type CouncilProviderCollection = Readonly<{
  task: CouncilTask;
  executions: readonly CouncilProviderExecution[];
}>;

type ScopedEvidence = Readonly<{
  scope: TenantScope;
  evidence: CouncilEvidenceRecord;
}>;

export class InMemoryCouncilEvidenceStore {
  private readonly records: ScopedEvidence[] = [];

  append(scope: TenantScope, evidence: CouncilEvidenceRecord): void {
    this.records.push(Object.freeze({
      scope: Object.freeze({ ...scope }),
      evidence,
    }));
  }

  list(scope: TenantScope, taskId?: string): CouncilEvidenceRecord[] {
    return this.records
      .filter((record) => sameScope(record.scope, scope))
      .map((record) => record.evidence)
      .filter((evidence) => taskId == null || evidence.taskId === taskId);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashResponse(response: CouncilResponseEnvelope): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(response));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

function appendAudit(
  audit: AuditSink,
  event: Omit<AuditEvent, 'id' | 'timestamp'>,
  options: { id: () => string; now: () => string },
): void {
  audit.append({
    ...event,
    id: options.id(),
    timestamp: options.now(),
  });
}

export function createCouncilConsensusWorkflow(options: {
  audit: AuditSink;
  evidenceStore: InMemoryCouncilEvidenceStore;
  now?: () => string;
  executionId?: () => string;
  evidenceId?: () => string;
  auditId?: () => string;
}) {
  const now = options.now ?? (() => new Date().toISOString());
  const executionId = options.executionId ?? (() => `ai-exec-${crypto.randomUUID()}`);
  const evidenceId = options.evidenceId ?? (() => `ai-evidence-${crypto.randomUUID()}`);
  const auditId = options.auditId ?? (() => `ai-audit-${crypto.randomUUID()}`);

  return Object.freeze({
    async collect(input: {
      task: CouncilTask;
      actorId: string;
      policyContext: Readonly<Record<string, unknown>>;
      providers: readonly CouncilProviderAdapter[];
    }): Promise<CouncilProviderCollection> {
      if (input.task.state !== 'authorized') {
        throw new Error(`AI Council provider collection requires authorized task, got ${input.task.state}`);
      }
      if (input.task.command.kind !== 'ask') {
        throw new Error('AI Council provider collection requires an /ask command');
      }
      if (input.providers.length === 0) {
        throw new Error('AI Council provider collection requires at least one provider');
      }

      const queued = transitionCouncilTask(input.task, 'queued', now);
      const collecting = transitionCouncilTask(queued, 'collecting', now);
      const prompt = input.task.command.prompt;
      const scope = { tenantId: input.task.tenantId, organizationId: input.task.organizationId };

      const scheduled = input.providers.map((provider) => ({
        provider,
        executionId: executionId(),
      }));

      const executions = await Promise.all(
        scheduled.map(async ({ provider, executionId: currentExecutionId }): Promise<CouncilProviderExecution> => {
          try {
            const raw = await provider.invoke({
              task: collecting,
              prompt,
              policyContext: input.policyContext,
            });
            const response = provider.normalize(raw, currentExecutionId);
            const responseHash = await hashResponse(response);
            const evidence = createCouncilEvidence(
              {
                taskId: input.task.taskId,
                executionId: currentExecutionId,
                kind: 'provider_response',
                reference: `ai-council://${input.task.taskId}/executions/${currentExecutionId}`,
                contentHash: responseHash,
              },
              { id: evidenceId, now },
            );
            options.evidenceStore.append(scope, evidence);
            appendAudit(
              options.audit,
              {
                tenantId: scope.tenantId,
                organizationId: scope.organizationId,
                actorId: input.actorId,
                action: 'ai_council.provider.completed',
                entityType: 'ai_council_execution',
                entityId: currentExecutionId,
                before: null,
                after: {
                  provider: provider.providerId,
                  status: 'completed',
                  evidenceId: evidence.evidenceId,
                  responseHash,
                },
                correlationId: input.task.taskId,
              },
              { id: auditId, now },
            );
            return Object.freeze({
              executionId: currentExecutionId,
              provider: provider.providerId,
              status: 'completed' as const,
              response,
              evidenceId: evidence.evidenceId,
            });
          } catch {
            appendAudit(
              options.audit,
              {
                tenantId: scope.tenantId,
                organizationId: scope.organizationId,
                actorId: input.actorId,
                action: 'ai_council.provider.failed',
                entityType: 'ai_council_execution',
                entityId: currentExecutionId,
                before: null,
                after: {
                  provider: provider.providerId,
                  status: 'failed',
                  errorClass: 'provider_error',
                },
                correlationId: input.task.taskId,
              },
              { id: auditId, now },
            );
            return Object.freeze({
              executionId: currentExecutionId,
              provider: provider.providerId,
              status: 'failed' as const,
              errorClass: 'provider_error' as const,
            });
          }
        }),
      );

      const allCompleted = executions.every((entry) => entry.status === 'completed');
      const nextTask = transitionCouncilTask(
        collecting,
        allCompleted ? 'ready_for_consensus' : 'degraded',
        now,
      );

      return Object.freeze({
        task: nextTask,
        executions: Object.freeze(executions),
      });
    },

    finalize(input: {
      collection: CouncilProviderCollection;
      outcomes: readonly CouncilProviderOutcome[];
      actorId: string;
    }) {
      if (input.collection.task.state !== 'ready_for_consensus') {
        throw new Error(`AI Council consensus requires ready_for_consensus task, got ${input.collection.task.state}`);
      }

      const executions = input.collection.executions;
      const collectedIds = executions.map((entry) => entry.executionId).sort();
      const outcomeIds = input.outcomes.map((outcome) => outcome.executionId).sort();
      const sameIds =
        collectedIds.length === outcomeIds.length &&
        collectedIds.every((id, index) => id === outcomeIds[index]);
      if (!sameIds) {
        throw new Error('Consensus outcomes must correspond exactly to collected executions');
      }

      const providerByExecution = new Map(
        executions.map((entry) => [entry.executionId, entry.provider] as const),
      );
      if (input.outcomes.some((outcome) => providerByExecution.get(outcome.executionId) !== outcome.provider)) {
        throw new Error('Consensus provider identity must match collected executions');
      }

      const decision = evaluateCouncilConsensus(input.outcomes);
      const consensusComplete = transitionCouncilTask(
        input.collection.task,
        'consensus_complete',
        now,
      );
      const withDecision = Object.freeze({
        ...consensusComplete,
        consensusState: decision.state,
      });
      const terminalState =
        decision.state === 'blocked' || decision.state === 'insufficient_evidence'
          ? 'blocked'
          : 'awaiting_human_approval';
      const task = transitionCouncilTask(withDecision, terminalState, now);

      appendAudit(
        options.audit,
        {
          tenantId: task.tenantId,
          organizationId: task.organizationId,
          actorId: input.actorId,
          action: 'ai_council.consensus.decided',
          entityType: 'ai_council_task',
          entityId: task.taskId,
          before: { consensusState: 'pending' },
          after: {
            consensusState: decision.state,
            ruleVersion: decision.ruleVersion,
            executionIds: decision.executionIds,
            conditions: decision.conditions,
          },
          correlationId: task.taskId,
        },
        { id: auditId, now },
      );

      return Object.freeze({ task, decision });
    },
  });
}
