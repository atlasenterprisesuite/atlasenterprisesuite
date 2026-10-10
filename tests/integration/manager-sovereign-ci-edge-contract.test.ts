import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const ciSource = readFileSync('supabase/functions/atlas-execution/sovereign-ci.ts', 'utf8');
const reportSource = readFileSync('supabase/functions/atlas-sovereign-ci-report/index.ts', 'utf8');
const domainSource = readFileSync('packages/execution/src/sovereign-ci.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261010095100_manager_sovereign_ci.sql', 'utf8');
const supabaseConfig = readFileSync('supabase/config.toml', 'utf8');

describe('ATLAS Manager Sovereign CI Edge contract', () => {
  it('keeps user start in atlas-execution and GitHub OIDC reports in a dedicated adapter', () => {
    expect(edgeSource).toContain("'start_manager_sovereign_ci'");
    expect(edgeSource).not.toContain("'report_manager_sovereign_ci'");
    expect(ciSource).toContain('manager.sovereign_ci');
    expect(ciSource).toContain("requireExecutionPermission(deps.context, 'execution.write')");
    expect(reportSource).toContain("const AUDIENCE = 'atlas-sovereign-ci'");
  });

  it('dispatches only the allowlisted canonical workflow and never mutates source or deploys', () => {
    expect(ciSource).toContain('atlasenterprisesuite/atlasenterprisesuite');
    expect(ciSource).toContain('atlas-sovereign-ci.yml');
    expect(edgeSource).toContain('ATLAS_GITHUB_TOKEN');
    expect(ciSource).toContain('/actions/workflows/');
    const executableBoundary = [ciSource, reportSource].join('\n').toLowerCase();
    expect(executableBoundary).not.toContain('git push');
    expect(executableBoundary).not.toContain('git merge');
    expect(executableBoundary).not.toContain('wrangler deploy');
    expect(executableBoundary).not.toContain('vercel deploy');
    expect(executableBoundary).not.toContain('supabase functions deploy');
  });

  it('pins and persists immutable target and command evidence', () => {
    expect(domainSource).toContain('SOVEREIGN_CI_COMMANDS');
    expect(reportSource).toContain('resolved_sha');
    expect(reportSource).toContain('requested_ref');
    expect(reportSource).toContain('manager.ci.target');
    expect(reportSource).toContain('manager.ci.install');
    expect(reportSource).toContain('manager.ci.typecheck');
    expect(reportSource).toContain('manager.ci.test');
    expect(reportSource).toContain('manager.ci.build');
    expect(reportSource).toContain('manager.ci.gate');
    expect(reportSource).toContain('evaluateSovereignCiGate');
  });

  it('authenticates reports with the dedicated GitHub OIDC audience and workflow identity', () => {
    expect(reportSource).toContain('atlas-sovereign-ci');
    expect(reportSource).toContain('token.actions.githubusercontent.com');
    expect(reportSource).toContain('workflow_ref');
    expect(reportSource).toContain('refs/heads/main');
    expect(reportSource).toContain('constantTime');
    expect(reportSource).toContain("event_name");
    expect(supabaseConfig).toMatch(/\[functions\.atlas-sovereign-ci-report\][\s\S]*verify_jwt\s*=\s*false/);
  });

  it('records a blocked target-resolution result without fabricating a sha', () => {
    expect(reportSource).toContain('target_resolution_failure');
    expect(reportSource).toContain('target_resolution_failed');
    expect(reportSource).toContain("verified: false");
  });

  it('extends generic execution evidence with bounded metadata without a new CI database', () => {
    expect(migration).toContain('alter table public.execution_evidence');
    expect(migration).toContain('add column if not exists metadata jsonb');
    expect(migration).not.toContain('create table');
    expect(reportSource).toContain('metadata');
  });
});
