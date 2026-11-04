import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');
describe('ATLAS runtime lease completion guard', () => {
  it('checks lease expiry both before and inside conditional persistence update', () => {
    const complete = source.slice(source.indexOf('export async function completeWorkRuntimeJob('));
    expect(complete).toContain("Date.now() >= expiry");
    expect(complete).toContain(".eq('lease_id', leaseId)");
    expect(complete).toContain(".gt('lease_expires_at', new Date().toISOString())");
    expect(complete).toContain(".in('state', ['claimed', 'running'])");
  });
  it('does not allow completion without scoped runtime and tenant filters', () => {
    const complete = source.slice(source.indexOf('export async function completeWorkRuntimeJob('));
    expect(complete).toContain(".eq('runtime_id', context.runtimeId)");
    expect(complete).toContain(".eq('org_id', context.orgId)");
    expect(complete).toContain(".eq('tenant_id', context.tenantId)");
  });
});
