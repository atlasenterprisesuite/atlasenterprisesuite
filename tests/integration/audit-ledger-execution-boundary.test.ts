import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const edgeUrl = new URL('../../supabase/functions/atlas-execution/index.ts', import.meta.url);
const storeUrl = new URL('../../supabase/functions/_shared/audit-ledger-store.ts', import.meta.url);

async function sources() {
  const [edge, store] = await Promise.all([readFile(edgeUrl, 'utf8'), readFile(storeUrl, 'utf8')]);
  return { edge, store };
}

describe('ATLAS Audit Ledger execution boundary', () => {
  it('seals operational audits through the shared audit ledger service', async () => {
    const { edge, store } = await sources();
    expect(edge).toContain('AuditLedgerServiceImpl');
    expect(edge).toContain('SupabaseAuditLedgerStore');
    expect(store).toContain("rpc('append_audit_ledger_event'");
    expect(edge).toContain('audit_ledger_lineage_required');
    expect(edge).toContain('audit_ledger_persistence_failed');
  });

  it('derives ledger metadata from authorized persisted audit context only', async () => {
    const { edge } = await sources();
    expect(edge).toContain('module: input.module');
    expect(edge).toContain('previousState: input.previousState');
    expect(edge).toContain('resultingState: input.resultingState');
    expect(edge).toContain('evidenceIds: input.evidenceIds || []');
    expect(edge).toContain('correlationId: input.correlationId');
    expect(edge).not.toContain('body.tenant_id');
  });

  it('preserves the fail-closed evidence verification guard', async () => {
    const { edge } = await sources();
    expect(edge).toContain('verified_evidence_resolver_required');
    expect(edge).toContain('if (body.verified === true)');
    expect(edge).toContain('verified: false');
  });

  it('scopes store reads by organization, tenant, and workflow', async () => {
    const { store } = await sources();
    expect(store).toContain(".eq('org_id', scope.organizationId)");
    expect(store).toContain(".eq('tenant_id', scope.tenantId)");
    expect(store).toContain(".eq('workflow_id', scope.workflowId)");
  });
});
