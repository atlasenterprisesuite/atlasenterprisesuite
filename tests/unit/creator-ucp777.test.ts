import { describe,it,expect } from 'vitest';
import { encodeNibble,decodeNibble,encodeUcp,decodeUcp,fuseUcp } from '../../packages/creator/audio/ucp777';
describe('UCP-777',()=>{
  it('covers all 592 zero, single and double error cases',()=>{
    for(let n=0;n<16;n++){
      const c=encodeNibble(n);
      expect(decodeNibble(c).value).toBe(n);
      for(let i=0;i<8;i++){
        expect(decodeNibble(c^(1<<i))).toEqual({value:n,corrected:true});
        for(let j=i+1;j<8;j++)expect(()=>decodeNibble(c^(1<<i)^(1<<j))).toThrow();
      }
    }
  });
  it('reuses ARTURO framing and restores UTF-8',()=>{
    const c=encodeUcp('Paz y música');
    expect(decodeUcp(c)).toBe('Paz y música');
    expect(decodeUcp(c.map(v=>v^1))).toBe('Paz y música');
    expect(()=>decodeUcp(c.map(v=>v^3))).toThrow();
  });
  it('recovers by majority and blocks conflicts and insufficient channels',()=>{
    const a=encodeUcp('PAZ'),b=encodeUcp('SOL');
    expect(fuseUcp([a,a,b])).toBe('PAZ');
    expect(fuseUcp([a,a,null])).toBe('PAZ');
    expect(()=>fuseUcp([a,b,null])).toThrow();
    expect(()=>fuseUcp([a,null,null])).toThrow();
  });
  it('rejects invalid codewords and frame sizes',()=>{
    for(const n of [-1,256,NaN,1.5])expect(()=>decodeNibble(n)).toThrow();
    expect(()=>encodeNibble(16)).toThrow();
    expect(()=>decodeUcp([])).toThrow();
  });
});
