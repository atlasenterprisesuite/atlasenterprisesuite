import type { AgentDiffField } from './diff';
import type { AgentVersion } from './types';
import { createAgentDraft } from './versioning';

export type AgentMergeConflict = {
  field: AgentDiffField;
  left: unknown;
  right: unknown;
};

export type AgentMergeResult =
  | { ok: true; version: AgentVersion }
  | { ok: false; conflicts: AgentMergeConflict[] };

const fields: AgentDiffField[] = [
  'provider',
  'model',
  'coreInstructions',
  'permissions',
  'tools',
  'safetyRules',
  'channelInstructions'
];

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeAgentVersions(
  base: AgentVersion,
  left: AgentVersion,
  right: AgentVersion,
  versionId: string,
  createdByActorId: string,
  createdAt: string
): AgentMergeResult {
  const values = {} as Record<AgentDiffField, unknown>;
  const conflicts: AgentMergeConflict[] = [];

  for (const field of fields) {
    const baseValue = base[field];
    const leftValue = left[field];
    const rightValue = right[field];

    if (equal(leftValue, rightValue)) values[field] = leftValue;
    else if (equal(leftValue, baseValue)) values[field] = rightValue;
    else if (equal(rightValue, baseValue)) values[field] = leftValue;
    else conflicts.push({ field, left: leftValue, right: rightValue });
  }

  if (conflicts.length) return { ok: false, conflicts };

  return {
    ok: true,
    version: createAgentDraft({
      agentId: base.agentId,
      versionId,
      parentVersionId: base.versionId,
      scope: base.scope,
      provider: values.provider as string,
      model: values.model as string,
      coreInstructions: values.coreInstructions as string,
      permissions: values.permissions as AgentVersion['permissions'],
      tools: values.tools as AgentVersion['tools'],
      safetyRules: values.safetyRules as AgentVersion['safetyRules'],
      channelInstructions: values.channelInstructions as AgentVersion['channelInstructions'],
      createdByActorId,
      createdAt
    })
  };
}
