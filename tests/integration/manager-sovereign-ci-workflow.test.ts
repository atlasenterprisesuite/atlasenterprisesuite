import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/atlas-sovereign-ci.yml', 'utf8');

describe('ATLAS Sovereign CI GitHub runner', () => {
  it('is manual/on-demand only and cannot become an automatic deployment trigger', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).not.toMatch(/\n\s+pull_request:/);
    expect(workflow.toLowerCase()).not.toContain('wrangler deploy');
    expect(workflow.toLowerCase()).not.toContain('vercel deploy');
    expect(workflow.toLowerCase()).not.toContain('supabase functions deploy');
  });

  it('keeps OIDC out of the job that executes target source code', () => {
    const verifyStart = workflow.indexOf('  verify:');
    const reportStart = workflow.indexOf('  report:');
    expect(verifyStart).toBeGreaterThan(-1);
    expect(reportStart).toBeGreaterThan(verifyStart);
    const verifyBlock = workflow.slice(verifyStart, reportStart);
    const reportBlock = workflow.slice(reportStart);
    expect(verifyBlock).toContain('contents: read');
    expect(verifyBlock).not.toContain('id-token: write');
    expect(verifyBlock).not.toContain('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(reportBlock).toContain('id-token: write');
    expect(reportBlock).toContain('contents: none');
    expect(reportBlock).toContain('needs: verify');
    expect(workflow).not.toContain('contents: write');
  });

  it('checks out the explicit requested ref and records the resolved immutable sha', () => {
    expect(workflow).toContain('requested_ref:');
    expect(workflow).toContain('workflow_id:');
    expect(workflow).toContain('task_id:');
    expect(workflow).toContain('dispatch_nonce:');
    expect(workflow).toContain('ref: ${{ inputs.requested_ref }}');
    expect(workflow).toContain('git rev-parse HEAD');
    expect(workflow).toContain('RESOLVED_SHA');
    expect(workflow).toContain('continue-on-error: true');
    expect(workflow).toContain('target_resolution_failed');
  });

  it('runs only the canonical npm verification sequence', () => {
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
    expect(workflow).not.toContain('shell: true');
  });

  it('reports results back through GitHub OIDC to atlas-execution', () => {
    expect(workflow).toContain('audience=atlas-sovereign-ci');
    expect(workflow).toContain('/functions/v1/atlas-sovereign-ci-report');
    expect(workflow).toContain('DISPATCH_NONCE');
    expect(workflow).not.toContain('/functions/v1/atlas-execution');
  });
});
