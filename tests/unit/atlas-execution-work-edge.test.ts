import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const workSource = readFileSync('supabase/functions/atlas-execution/work.ts', 'utf8');

describe('ATLAS Work execution Edge contract', () => {
  it('registers create/list operations with the expected execution permissions', () => {
    expect(edgeSource).toContain("'create_workflow_plan'");
    expect(edgeSource).toContain("'list_workflows'");
    expect(edgeSource).toContain("requireExecutionPermission(context, 'execution.write')");
    expect(edgeSource).toContain("requireExecutionPermission(context, 'execution.read')");
  });

  it('creates ordinary canonical workflow, task and step rows', () => {
    expect(workSource).toContain("from('execution_workflows').insert");
    expect(workSource).toContain("from('execution_tasks').insert");
    expect(workSource).toContain("from('execution_steps').insert");
    expect(workSource).toContain("workflow_type: 'work.sovereign'");
    expect(workSource).toContain("action_type: 'prepare_execution_plan'");
    expect(workSource).toContain("action: 'execution.workflow.created'");
  });

  it('compensates explicitly and never persists raw secret fields', () => {
    expect(workSource).toContain("from('execution_steps').delete()");
    expect(workSource).toContain("from('execution_tasks').delete()");
    expect(workSource).toContain("from('execution_workflows').delete()");
    expect(workSource).not.toContain('password:');
    expect(workSource).not.toContain('token:');
    expect(workSource).not.toContain('cookie:');
    expect(workSource).not.toContain('secret:');
  });

  it('lists only Work workflows scoped to the active organization', () => {
    expect(workSource).toContain(".eq('org_id', context.orgId)");
    expect(workSource).toContain(".eq('workflow_type', 'work.sovereign')");
    expect(workSource).toContain('.limit(100)');
    expect(workSource).not.toContain('action_payload');
  });
});
