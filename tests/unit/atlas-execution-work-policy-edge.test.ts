import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const policySource = readFileSync('supabase/functions/atlas-execution/work-policy.ts', 'utf8');

describe('ATLAS Work server policy evaluation', () => {
  it('registers evaluate_work_step behind execution.read', () => {
    expect(edgeSource).toContain("'evaluate_work_step'");
    expect(edgeSource).toContain("requireExecutionPermission(context, 'execution.read')");
    expect(edgeSource).toContain('evaluateWorkStepServer');
  });

  it('loads workflow task and current step inside the authenticated organization', () => {
    expect(policySource).toContain("from('execution_tasks')");
    expect(policySource).toContain("from('execution_workflows')");
    expect(policySource).toContain("from('execution_steps')");
    expect(policySource).toContain(".eq('org_id', context.orgId)");
    expect(policySource).toContain('parseAtlasWorkContext');
  });

  it('derives permission and budget truth server-side', () => {
    expect(policySource).toContain('permissionsSatisfied');
    expect(policySource).toContain('context.permissions');
    expect(policySource).toContain('work.budgetLimit');
    expect(policySource).not.toContain('body.permissionsSatisfied');
    expect(policySource).not.toContain('body.budgetLimit');
    expect(policySource).not.toContain('body.approval');
  });

  it('returns safe routing and policy decisions only', () => {
    expect(policySource).toContain('selectExecutionRoute');
    expect(policySource).toContain('evaluateWorkActionPolicy');
    expect(policySource).toContain('approvalRequired');
    expect(policySource).not.toContain('action_payload:');
  });
});
