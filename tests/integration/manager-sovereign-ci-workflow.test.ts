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

  it('uses least-privilege read plus OIDC report permissions', () => {
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('id-token: write');
    expect(workflow).not.toContain('contents: write');
  });

  it('checks out the explicit requested ref and records the resolved immutable sha', () => {
    expect(workflow).toContain('requested_ref:');
    expect(workflow).toContain('workflow_id:');
    expect(workflow).toContain('task_id:');
    expect(workflow).toContain('ref: ${{ inputs.requested_ref }}');
    expect(workflow).toContain('git rev-parse HEAD');
    expect(workflow).toContain('RESOLVED_SHA');
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
    expect(workflow).toContain('report_manager_sovereign_ci');
    expect(workflow).toContain('/functions/v1/atlas-execution');
  });
});
