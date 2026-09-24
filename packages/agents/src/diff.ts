import type { AgentVersion } from './types';

export type AgentDiffField =
  | 'provider'
  | 'model'
  | 'coreInstructions'
  | 'permissions'
  | 'tools'
  | 'safetyRules'
  | 'channelInstructions';

export type AgentDiff = {
  changedFields: AgentDiffField[];
  sensitiveFields: AgentDiffField[];
};

const fields: AgentDiffField[] = [
  'provider',
  'model',
  'coreInstructions',
  'permissions',
  'tools',
  'safetyRules',
  'channelInstructions'
];

const sensitive = new Set<AgentDiffField>([
  'provider',
  'model',
  'permissions',
  'tools',
  'safetyRules'
]);

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffAgentVersions(a: AgentVersion, b: AgentVersion): AgentDiff {
  const changedFields = fields.filter((field) => !equal(a[field], b[field]));

  return {
    changedFields,
    sensitiveFields: changedFields.filter((field) => sensitive.has(field))
  };
}
