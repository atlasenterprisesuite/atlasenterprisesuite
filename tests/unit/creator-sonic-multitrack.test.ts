import { describe, expect, it } from 'vitest';
import { mixSonicTracks } from '../../packages/creator/audio/sonic_multitrack';
const track = { left: new Float32Array([.5,.5]), right: new Float32Array([.5,.5]), gain:1, pan:0, mute:false, solo:false, offset:0 };
describe('SONIC multitrack',()=>{
  it('mixes aligned stereo tracks without clipping',()=>{
    const result=mixSonicTracks([track,track],8000);
    expect(result.left.length).toBe(2);
    expect(result.left[0]).toBeCloseTo(.8);
    expect(result.right[0]).toBeCloseTo(.8);
  });
  it('applies pan, offset, mute and solo',()=>{
    const result=mixSonicTracks([{...track,pan:-1,solo:true,offset:1},track],8000);
    expect(Array.from(result.left)).toEqual([0,.5,.5]);
    expect(Array.from(result.right)).toEqual([0,0,0]);
    expect(mixSonicTracks([{...track,mute:true}],8000).left[0]).toBe(0);
  });
  it('rejects invalid inputs',()=>{
    expect(()=>mixSonicTracks([{...track,gain:Infinity}],8000)).toThrow();
    expect(()=>mixSonicTracks([{...track,left:new Float32Array([NaN])}],8000)).toThrow();
    expect(()=>mixSonicTracks([{...track,offset:99999999}],8000)).toThrow();
  });
});
