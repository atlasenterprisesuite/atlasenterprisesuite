import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const ciSource = readFileSync('supabase/functions/atlas-execution/sovereign-ci.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261010095100_manager_sovereign_ci.sql', 'utf8');

describe('ATLAS Manager Sovereign CI Edge contract', () => {
  it('registers a user start operation and a GitHub OIDC report operation', () => {
    expect(edgeSource).toContain("'start_manager_sovereign_ci'");
    expect(edgeSource).toContain("'report_manager_sovereign_ci'");
    expect(edgeSource).toContain('GITHUB_OIDC_OPERATIONS');
    expect(ciSource).toContain('manager.sovereign_ci');
    expect(ciSource).toContain("requireExecutionPermission(context, 'execution.write')");
  });

  it('dispatches only the allowlisted canonical workflow and never mutates source or deploys', () => {
    expect(ciSource).toContain('atlasenterprisesuite/atlasenterprisesuite');
    expect(ciSource).toContain('atlas-sovereign-ci.yml');
    expect(ciSource).toContain('ATLAS_GITHUB_TOKEN');
    expect(ciSource).toContain('/actions/workflows/atlas-sovereign-ci.yml/dispatches');
    expect(ciSource.toLowerCase()).not.toContain('git push');
    expect(ciSource.toLowerCase()).not.toContain('git merge');
    expect(ciSource.toLowerCase()).not.toContain('wrangler deploy');
    expect(ciSource.toLowerCase()).not.toContain('vercel deploy');
    expect(ciSource.toLowerCase()).not.toContain('supabase functions deploy');
  });

  it('pins and persists the immutable target sha before accepting command evidence', () => {
    expect(ciSource).toContain('resolved_sha');
    expect(ciSource).toContain('requested_ref');
    expect(ciSource).toContain('manager.ci.target');
    expect(ciSource).toContain('manager.ci.install');
    expect(ciSource).toContain('manager.ci.typecheck');
    expect(ciSource).toContain('manager.ci.test');
    expect(ciSource).toContain('manager.ci.build');
    expect(ciSource).toContain('manager.ci.gate');
    expect(ciSource).toContain('evaluateSovereignCiGate');
  });

  it('authenticates reports with the dedicated GitHub OIDC audience and workflow identity', () => {
    expect(ciSource).toContain('atlas-sovereign-ci');
    expect(ciSource).toContain('token.actions.githubusercontent.com');
    expect(ciSource).toContain('workflow_ref');
    expect(ciSource).toContain('refs/heads/main');
    expect(ciSource).toContain('constantTime');
  });

  it('extends generic execution evidence with bounded metadata without a new CI database', () => {
    expect(migration).toContain('alter table public.execution_evidence');
    expect(migration).toContain('add column if not exists metadata jsonb');
    expect(migration).not.toContain('create table');
    expect(ciSource).toContain('metadata');
  });
});
