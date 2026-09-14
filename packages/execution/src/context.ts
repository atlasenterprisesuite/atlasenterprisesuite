import type { DomainReference, ExecutionScope } from './types';

export function assertSameScope(a: ExecutionScope, b: ExecutionScope) {
  if (a.tenantId !== b.tenantId || a.organizationId !== b.organizationId) {
    throw new Error('execution_scope_mismatch');
  }
}

export function buildContextHandoff(input: {
  workflowId: string;
  fromModule: string;
  toModule: string;
  scope: ExecutionScope;
  references: DomainReference[];
  nextAction: string;
}) {
  return {
    workflowId: input.workflowId,
    fromModule: input.fromModule,
    toModule: input.toModule,
    scope: { ...input.scope },
    references: input.references.map((reference) => ({ ...reference })),
    nextAction: input.nextAction
  };
}
