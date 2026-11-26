import { describe, expect, it } from 'vitest';
import { encodeArturo, decodeArturo, simulateArturo } from '../../packages/creator/audio/arturo_signal';
describe('Arturo educational simulation',()=>{
  it('round trips UTF-8 text as musical pitches',()=>{
    const frame=encodeArturo('Paz y música');
    expect(decodeArturo(frame)).toBe('Paz y música');
  });
  it('rejects a corrupted payload',()=>{
    const frame=encodeArturo('ABC');
    frame[8]=frame[8]===60?61:60;
    expect(()=>decodeArturo(frame)).toThrow();
  });
  it('labels every simulated result and rejects invalid bounds',()=>{
    expect(simulateArturo(encodeArturo('777'),0,777)).toMatchObject({source:'synthetic',transmitted:false,receivedFromSpace:false});
    expect(()=>encodeArturo('x'.repeat(100))).toThrow();
    expect(()=>simulateArturo([60],NaN,777)).toThrow();
  });
});
