import { describe,it,expect } from 'vitest';
import { summarizeAuraWork } from '../../apps/web/src/work/auraScope';
describe('AURA scope',()=>{
 it('counts only matching organization workflows',()=>expect(summarizeAuraWork('a',[{organizationId:'a',status:'running'},{organizationId:'b',status:'running'}])).toEqual({total:1,byStatus:{running:1}}));
 it('rejects missing scope',()=>expect(()=>summarizeAuraWork('',[])).toThrow());
 it('does not invent a running state',()=>expect(summarizeAuraWork('a',[{organizationId:'a',status:'unknown'}]).byStatus).toEqual({unknown:1}));
});
