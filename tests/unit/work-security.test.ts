import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const pilot = readFileSync('supabase/functions/atlas-execution/openai-domain.ts', 'utf8');
const runtime = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260912_atlas_work_runtime.sql', 'utf8');

describe('ATLAS Work security boundaries', () => {
  it('never hard-codes the OpenAI verification value or common credential names', () => {
    const combined = `${pilot}\n${runtime}`;
    expect(combined).not.toContain('openai-domain-verification=');
    expect(combined).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(combined).not.toContain('OPENAI_API_KEY');
    expect(combined).not.toContain('GITHUB_TOKEN');
  });

  it('keeps action_payload out of ordinary Guided state reads', () => {
    const getStateSection = edge.slice(edge.indexOf('async function getState'), edge.indexOf('async function getAudit'));
    expect(getStateSection).toContain("action_type,status,completion_criteria");
    expect(getStateSection).not.toContain("select('*').eq('org_id', context.orgId).in('task_id', taskIds).order('sequence')");
  });

  it('uses separate runtime authentication and refuses browser-side runtime token storage', () => {
    expect(edge).toContain('RUNTIME_OPERATIONS');
    expect(edge).toContain('x-atlas-runtime-id');
    expect(edge).toContain('resolveRuntimeContext');
    expect(runtime).toContain('auth_token_hash');
    expect(migration).toContain('revoke all on public.execution_runtime_registrations from authenticated');
    expect(migration).not.toContain('grant select on public.execution_runtime_registrations to authenticated');
    expect(migration).not.toContain('grant select on public.execution_runtime_jobs to authenticated');
  });

  it('rejects secret-like object keys on connection registration', () => {
    expect(edge).toContain('containsSensitiveInputKey');
    expect(edge).toContain('secret_material_not_allowed');
  });

  it('keeps paid-provider default at zero and production mutation outside CI', () => {
    const template = readFileSync('packages/execution/src/work-templates.ts', 'utf8');
    expect(template).toContain('budgetLimit: 0');
    expect(pilot).not.toContain('deploy');
  });
});
