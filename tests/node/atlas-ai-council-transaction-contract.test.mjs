import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../docs/security/ai-council-approval-transaction.preview.sql',import.meta.url),'utf8');
test('transaction candidate is private, invoker-only and not publicly executable',()=>{
 assert.match(sql,/create schema if not exists atlas_council_private/i);
 assert.match(sql,/security invoker/i);
 assert.match(sql,/revoke all on function .* from public, anon, authenticated/i);
 assert.doesNotMatch(sql,/grant execute/i);
});
test('approval is tenant, actor, action and expiry bound',()=>{
 for(const s of ['org_id=p_org_id','requested_by=p_user_id',"status='approved'",'expires_at>clock_timestamp()',"subject_type='ai_council'","metadata->>'proposal_hash'=p_proposal_hash"])assert.ok(sql.includes(s),s);
});
test('single use and audit occur in one function transaction',()=>{
 assert.match(sql,/approval_id uuid primary key/i);
 assert.match(sql,/for update/i);
 assert.match(sql,/insert into atlas_council_private\.approval_consumptions/i);
 assert.match(sql,/insert into public\.execution_audit_events/i);
 assert.doesNotMatch(sql,/exception when others/i);
});
