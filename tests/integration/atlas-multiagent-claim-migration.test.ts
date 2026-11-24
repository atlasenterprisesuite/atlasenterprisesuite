import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const sql = readFileSync('supabase/migrations/20261026185000_atlas_multiagent_atomic_claim.sql','utf8');
describe('ATLAS multiagent durable claim migration contract',()=>{
 it('enforces tenant-scoped atomic uniqueness',()=>{expect(sql).toContain('primary key (tenant_id, organization_id, idempotency_key)');expect(sql).toContain('on conflict (tenant_id,organization_id,idempotency_key) do nothing');});
 it('rejects unauthenticated and missing scoped tasks',()=>{expect(sql).toContain('private.atlas_orchestrator_runtime_authorized()');expect(sql).toContain('atlas_multiagent_task_scope_missing');});
 it('binds claims to existing tasks within the same tenant and organization',()=>{expect(sql).toContain('foreign key (tenant_id, organization_id, task_id)');expect(sql).toContain('references public.atlas_orchestrator_tasks (tenant_id, organization_id, task_id)');});
 it('keeps table inaccessible to clients',()=>{expect(sql).toContain('enable row level security');expect(sql).toContain('revoke all on public.atlas_multiagent_dispatch_claims from public, anon, authenticated');});

 it('never grants anonymous API users EXECUTE on provider-claim functions',()=>{
   expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+private\.atlas_multiagent_claim_internal\([^)]*\)\s+to\s+anon/i);
   expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.atlas_multiagent_claim\([^)]*\)\s+to\s+anon/i);
   expect(sql).toContain('to service_role;');
 });
});
