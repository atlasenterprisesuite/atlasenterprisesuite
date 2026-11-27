import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const source=readFileSync('supabase/functions/atlas-execution/index.ts','utf8');
const handler=source.slice(source.indexOf('async function listAuraEventReferences'),source.indexOf('async function listWorkflows(req:'));
describe('AURA transport source contract',()=>{
 it('requires read permission before querying',()=>expect(handler.indexOf("requireExecutionPermission(context, 'execution.read')")).toBeLessThan(handler.indexOf('await adminClient()')));
 it('restricts both scope dimensions',()=>{expect(handler).toContain(".eq('org_id', context.orgId)");expect(handler).toContain(".eq('tenant_id', context.tenantId)");});
 it('selects references only',()=>expect(handler).toContain(".select('id,org_id,tenant_id,version')"));
 it('fails closed on invalid references',()=>expect(handler).toContain("throw new EdgeError('invalid_event_scope', 500)"));
});
