export type CouncilEvidenceKind =
  | 'discussion'
  | 'provider_response'
  | 'issue'
  | 'pull_request'
  | 'commit'
  | 'ci_status'
  | 'policy_decision';

export type CouncilEvidenceRecord = Readonly<{
  evidenceId: string;
  taskId: string;
  executionId: string | null;
  kind: CouncilEvidenceKind;
  reference: string;
  contentHash: string | null;
  createdAt: string;
}>;

export type CouncilEvidenceInput = {
  taskId: string;
  executionId?: string | null;
  kind: CouncilEvidenceKind;
  reference: string;
  contentHash?: string | null;
};

export function createCouncilEvidence(
  input: CouncilEvidenceInput,
  options: { id?: () => string; now?: () => string } = {},
): CouncilEvidenceRecord {
  const id = options.id ?? (() => `ai-evidence-${crypto.randomUUID()}`);
  const now = options.now ?? (() => new Date().toISOString());

  return Object.freeze({
    evidenceId: id(),
    taskId: input.taskId,
    executionId: input.executionId ?? null,
    kind: input.kind,
    reference: input.reference,
    contentHash: input.contentHash ?? null,
    createdAt: now(),
  });
}
