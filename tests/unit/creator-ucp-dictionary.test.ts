import { describe,it,expect } from 'vitest';
import { vocabulary,encodeConcepts,decodeConcepts,representSymbol,recoverSymbol } from '../../packages/creator/audio/ucp_dictionary';
describe('UCP dictionary v1',()=>{
  it('round trips every concept through canonical UCP',()=>{
    for(const concept of vocabulary)expect(decodeConcepts(encodeConcepts([concept]))).toEqual([concept]);
    expect(decodeConcepts(encodeConcepts(vocabulary))).toEqual(vocabulary);
  });
  it('recovers every symbol through each representation',()=>{
    for(let i=0;i<32;i++)for(const channel of ['math','music','geometry','light','vibration'] as const)
      expect(recoverSymbol(representSymbol(i,channel),channel)).toBe(i);
  });
  it('rejects invalid input',()=>{
    expect(()=>representSymbol(32,'music')).toThrow();
    expect(()=>recoverSymbol([60,99],'music')).toThrow();
    expect(()=>encodeConcepts(['unknown' as never])).toThrow();
    expect(()=>decodeConcepts([])).toThrow();
  });
});
