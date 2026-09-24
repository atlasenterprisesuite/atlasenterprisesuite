import { describe, expect, it } from 'vitest';
import { createEmptyMotionComposition } from '../../packages/creator/motion/defaults';
import { applyMotionOperations } from '../../packages/creator/motion/operations';

const layer = { id:'l1', name:'Title', kind:'text' as const, sceneId:null, parentLayerId:null, startSecond:0, endSecond:5, visible:true, locked:false, transform:{opacity:1}, tracks:[], effects:[], expression:null };

describe('motion operations',()=>{
  it('applies a valid layer proposal without mutating input',()=>{
    const input=createEmptyMotionComposition({id:'m',durationSeconds:5});
    const next=applyMotionOperations(input,[{type:'layer.add',layer}]);
    expect(input.layers).toHaveLength(0); expect(next.layers).toHaveLength(1);
  });
  it('rolls back invalid proposals by throwing before returning state',()=>{
    const input=createEmptyMotionComposition({id:'m',durationSeconds:5});
    expect(()=>applyMotionOperations(input,[{type:'layer.add',layer},{type:'layer.add',layer}])).toThrow();
    expect(input.layers).toHaveLength(0);
  });
});
