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
  if (!Number.isInteger(rate) || rate<8000 || rate>48000 || !(left instanceof Float32Array) || !(right instanceof Float32Array) || !left.length || left.length!==right.length || left.length>rate*30 || left.some(v=>!Number.isFinite(v)||Math.abs(v)>1) || right.some(v=>!Number.isFinite(v)||Math.abs(v)>1)) throw Error('Invalid stereo output');
  const b=new Uint8Array(44+left.length*4),v=new DataView(b.buffer);
  const tag=(at:number,s:string)=>{for(let i=0;i<s.length;i++)b[at+i]=s.charCodeAt(i);};
  tag(0,'RIFF');v.setUint32(4,b.length-8,true);tag(8,'WAVE');tag(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);
  tag(36,'data');v.setUint32(40,left.length*4,true);
  for(let i=0;i<left.length;i++){v.setInt16(44+i*4,Math.round(left[i]*32767),true);v.setInt16(46+i*4,Math.round(right[i]*32767),true);}
  return b;
}

export const SONIC_STUDIO_RATE=22050;
/** Strict bounded PCM16 parser; no browser codec allocation or network. */
export function decodeSonicPcm(bytes:ArrayBuffer):SonicTrack {
  if(bytes.byteLength<44||bytes.byteLength>6*1024*1024) throw Error('Invalid WAV size');
  const v=new DataView(bytes);
  const tag=(i:number)=>String.fromCharCode(v.getUint8(i),v.getUint8(i+1),v.getUint8(i+2),v.getUint8(i+3));
  if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||v.getUint32(4,true)!==bytes.byteLength-8) throw Error('Invalid WAV header');
  let fmt=0, data=0, length=0, at=12;
  while(at+8<=bytes.byteLength){
    const id=tag(at),n=v.getUint32(at+4,true),start=at+8,end=start+n;
    if(end+(n%2)>bytes.byteLength) throw Error('Truncated WAV');
    if(id==='fmt '){if(fmt||n!==16)throw Error('Unsupported WAV format');fmt=start;}
    if(id==='data'){if(data)throw Error('Duplicate WAV data');data=start;length=n;}
    at=end+n%2;
  }
  if(at!==bytes.byteLength||!fmt||!data)throw Error('Invalid WAV chunks');
  const channels=v.getUint16(fmt+2,true),rate=v.getUint32(fmt+4,true),align=v.getUint16(fmt+12,true);
  if(v.getUint16(fmt,true)!==1||v.getUint16(fmt+14,true)!==16||![1,2].includes(channels)||rate<8000||rate>48000||align!==channels*2||v.getUint32(fmt+8,true)!==rate*align||!length||length%align||length/align>rate*30)throw Error('Unsupported PCM16 WAV');
  const frames=length/align, count=Math.max(1,Math.round(frames*SONIC_STUDIO_RATE/rate));
  const left=new Float32Array(count),right=new Float32Array(count);
  for(let i=0;i<count;i++){
    const pos=Math.min(frames-1,i*rate/SONIC_STUDIO_RATE),lo=Math.floor(pos),hi=Math.min(frames-1,lo+1),a=pos-lo;
    const sample=(channel:number)=>(v.getInt16(data+lo*align+channel*2,true)*(1-a)+v.getInt16(data+hi*align+channel*2,true)*a)/32768;
    left[i]=sample(0);right[i]=sample(channels-1);
  }
  return {left,right,gain:.7,pan:0,mute:false,solo:false,offset:0};
}
