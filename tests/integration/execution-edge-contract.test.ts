import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const edgeUrl = new URL('../../supabase/functions/atlas-execution/index.ts', import.meta.url);

async function edgeSource() {
  return readFile(edgeUrl, 'utf8');
}

describe('ATLAS Universal Execution Edge contract', () => {
  it('requires authentication and active organization membership before mutation', async () => {
    const source = await edgeSource();
    expect(source).toContain("error: 'authentication_required'");
    expect(source).toContain(".from('organization_members')");
    expect(source).toContain(".eq('status', 'active')");
    expect(source).toContain(".eq('org_id', orgId)");
  });

  it('keeps service-role access server-side and exposes exactly the foundation operations', async () => {
    const source = await edgeSource();
    expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    for (const operation of [
      'get_state',
      'create_task',
      'transition_task',
      'record_evidence',
      'request_approval',
      'decide_approval'
    ]) expect(source).toContain(`'${operation}'`);
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('service_role_key:');
  });

  it('uses execution-layer RBAC without elevating org admin to domain permissions', async () => {
    const source = await edgeSource();
    expect(source).toContain('executionPermissionsForRole');
    expect(source).toContain("requireExecutionPermission(context, 'execution.read')");
    expect(source).toContain("requireExecutionPermission(context, 'execution.write')");
    expect(source).toContain("requireExecutionPermission(context, 'execution.approve')");
    expect(source).toContain('domain_permission_resolver_required');
    expect(source).not.toContain("'payroll.write':");
    expect(source).not.toContain("'accounting.post':");
  });

  it('fails closed on stale approvals and incomplete task completion', async () => {
    const source = await edgeSource();
    expect(source).toContain('approval_binding_mismatch');
    expect(source).toContain('payload_version');
    expect(source).toContain('payload_digest');
    expect(source).toContain('completion_requirements_not_met');
    expect(source).toContain('evaluateTaskCompletion');
  });

  it('does not let generic execution.write self-verify evidence', async () => {
    const source = await edgeSource();
    expect(source).toContain('verified_evidence_resolver_required');
    expect(source).toContain('if (body.verified === true)');
    expect(source).toContain('verified: false');
    expect(source).not.toContain('verified: body.verified === true');
  });

  it('inherits tenant scope from persisted workflow/task records and validates parent lineage', async () => {
    const source = await edgeSource();
    expect(source).toContain('tenant_id: String(workflow.tenant_id)');
    expect(source).toContain('tenant_id: String(task.tenant_id)');
    expect(source).toContain('await loadTask(admin, context.orgId, parentTaskId)');
    expect(source).toContain('parent_task_workflow_mismatch');
  });

  it('bounds authenticated JSON request bodies before execution work', async () => {
    const source = await edgeSource();
    expect(source).toContain('MAX_REQUEST_BYTES');
    expect(source).toContain('payload_too_large');
    expect(source).toContain("req.headers.get('content-length')");
    expect(source).toContain('new TextEncoder().encode(JSON.stringify(body)).byteLength');
  });

  it('uses runtime-neutral UUID generation for correlation and audit lineage', async () => {
    const source = await edgeSource();
    expect(source).toContain('crypto.randomUUID()');
    expect(source).not.toContain("from 'node:crypto'");
  });
});
