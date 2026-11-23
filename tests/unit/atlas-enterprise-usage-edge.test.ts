import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-execution/index.ts','utf8');
const service = readFileSync('supabase/functions/atlas-execution/enterprise-usage.ts','utf8');
const client = readFileSync('apps/web/src/work/api.ts','utf8');
const page = readFileSync('apps/web/src/work/WorkPoliciesPage.tsx','utf8');

describe('ATLAS Enterprise usage vertical integration', () => {
  it('reuses authenticated organization resolution and requires read permission', () => {
    expect(edge).toContain("'get_enterprise_usage'");
    expect(edge).toContain('const context = await resolveContext(req, orgId);');
    expect(edge).toContain("if (operation === 'get_enterprise_usage') {");
    expect(edge).toContain("requireExecutionPermission(context, 'execution.read');");
    expect(edge).toContain('readEnterpriseUsage({ admin: adminClient(), context })');
  });
  it('never derives protected usage filters or credit limits from client requests', () => {
    expect(service).toContain(".eq('org_id', context.orgId)");
    expect(service).toContain(".eq('actor_id', context.userId)");
    expect(service).not.toContain('body.actor_id');
    expect(service).not.toContain('body.limitCredits');
    expect(service).not.toContain('.insert(');
    expect(service).not.toContain('.update(');
    expect(service).not.toContain('.delete(');
  });
  it('uses the existing Work client and shows actual usage with fail-closed credits', () => {
    expect(client).toContain("operation: 'get_enterprise_usage'");
    expect(page).toContain('getEnterpriseUsage');
    expect(page).toContain('No paid AI credits are authorized');
    expect(page).toContain('Credit limits are not configured');
    expect(page).toContain('Recent recorded activity');
  });
});
