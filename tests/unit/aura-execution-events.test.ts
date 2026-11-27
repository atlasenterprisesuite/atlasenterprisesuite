import {describe,it,expect} from 'vitest';
import {parseAuraExecutionEvent} from '../../packages/execution/src/aura-events';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const scope={organizationId:a,tenantId:a};
const event={version:1,type:'execution.workflow.changed',organizationId:a,tenantId:a,workflowId:b,revision:1};
describe('AURA event invalidation',()=>{
 it('accepts scoped reference',()=>expect(parseAuraExecutionEvent(event,scope)).toEqual(event));
 it('rejects foreign organization',()=>expect(parseAuraExecutionEvent({...event,organizationId:b},scope)).toBeNull());
 it('rejects foreign tenant',()=>expect(parseAuraExecutionEvent({...event,tenantId:b},scope)).toBeNull());
 it('rejects payload expansion',()=>expect(parseAuraExecutionEvent({...event,context:{}},scope)).toBeNull());
 it('rejects invalid revision',()=>expect(parseAuraExecutionEvent({...event,revision:0},scope)).toBeNull());
 it('rejects mismatched trusted scope',()=>expect(parseAuraExecutionEvent(event,{organizationId:a,tenantId:b})).toBeNull());
});
