import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const sql = readFileSync('supabase/migrations/20261026185000_atlas_multiagent_atomic_claim.sql','utf8');
describe('ATLAS multiagent durable claim migration contract',()=>{
 it('enforces tenant-scoped atomic uniqueness',()=>{expect(sql).toContain('primary key (tenant_id, organization_id, idempotency_key)');expect(sql).toContain('on conflict (tenant_id,organization_id,idempotency_key) do nothing');});
 it('rejects unauthenticated and missing scoped tasks',()=>{expect(sql).toContain('private.atlas_orchestrator_runtime_authorized()');expect(sql).toContain('atlas_multiagent_task_scope_missing');});
 it('keeps table inaccessible to clients',()=>{expect(sql).toContain('enable row level security');expect(sql).toContain('revoke all on public.atlas_multiagent_dispatch_claims from public, anon, authenticated');});
});
