export type SonicTrack = { left: Float32Array; right: Float32Array; gain: number; pan: number; mute: boolean; solo: boolean; offset: number };
export function mixSonicTracks(tracks: readonly SonicTrack[], rate: number) {
  if (!Number.isInteger(rate) || rate < 8000 || rate > 48000 || !tracks.length || tracks.length > 4) throw Error('Invalid mix');
  let frames = 0;
  for (const t of tracks) {
    if (!(t.left instanceof Float32Array) || !(t.right instanceof Float32Array) || !t.left.length || t.left.length !== t.right.length ||
      !Number.isFinite(t.gain) || t.gain < 0 || t.gain > 1 || !Number.isFinite(t.pan) || Math.abs(t.pan) > 1 ||
      !Number.isInteger(t.offset) || t.offset < 0 || t.offset+t.left.length > rate*30 ||
      typeof t.mute !== 'boolean' || typeof t.solo !== 'boolean') throw Error('Invalid track');
    frames=Math.max(frames,t.offset+t.left.length);
  }
  const left=new Float32Array(frames),right=new Float32Array(frames);
  const solo=tracks.some(t=>t.solo&&!t.mute);
  for(const t of tracks) {
    const audible=!t.mute&&(!solo||t.solo);
    for(let i=0;i<t.left.length;i++){
      const l=t.left[i],r=t.right[i];
      if(!Number.isFinite(l)||!Number.isFinite(r)||Math.abs(l)>1||Math.abs(r)>1) throw Error('Invalid sample');
      if(audible){left[i+t.offset]+=l*t.gain*(1-Math.max(0,t.pan));right[i+t.offset]+=r*t.gain*(1+Math.min(0,t.pan));}
    }
  }
  let peak=0;
  for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  const scale=peak>.8?.8/peak:1;
  for(let i=0;i<frames;i++){left[i]*=scale;right[i]*=scale;}
  return {left,right,rate};
}
export function encodeSonicStereo(mix: ReturnType<typeof mixSonicTracks>): Uint8Array {
  const {left,right,rate}=mix;
  const b=new Uint8Array(44+left.length*4),v=new DataView(b.buffer);
  const tag=(at:number,s:string)=>{for(let i=0;i<s.length;i++)b[at+i]=s.charCodeAt(i);};
  tag(0,'RIFF');v.setUint32(4,b.length-8,true);tag(8,'WAVE');tag(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);
  tag(36,'data');v.setUint32(40,left.length*4,true);
  for(let i=0;i<left.length;i++){v.setInt16(44+i*4,Math.round(left[i]*32767),true);v.setInt16(46+i*4,Math.round(right[i]*32767),true);}
  return b;
}
