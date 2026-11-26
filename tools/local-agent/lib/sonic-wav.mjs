import { createHash } from 'node:crypto';
export const SONIC_MAX_WAV_BYTES=16*1024*1024;
const fail=()=>{throw Error('sonic_invalid_wav');};
export function inspectSonicWav(b,expectedSeconds){
  if(!Buffer.isBuffer(b)||b.length<44||b.length>SONIC_MAX_WAV_BYTES||!Number.isInteger(expectedSeconds)||expectedSeconds<10||expectedSeconds>30) fail();
  if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.readUInt32LE(4)!==b.length-8) fail();
  let fmt=null,data=null,at=12;
  while(at+8<=b.length){
    const id=b.toString('ascii',at,at+4),len=b.readUInt32LE(at+4),start=at+8,end=start+len;
    if(end+(len%2)>b.length) fail();
    if(id==='fmt '){
      if(fmt||len!==16) fail();
      fmt={format:b.readUInt16LE(start),channels:b.readUInt16LE(start+2),sampleRate:b.readUInt32LE(start+4),byteRate:b.readUInt32LE(start+8),align:b.readUInt16LE(start+12),bits:b.readUInt16LE(start+14)};
    } else if(id==='data'){
      if(data) fail();data={start,end,len};
    }
    at=end+(len%2);
  }
  if(at!==b.length||!fmt||!data||fmt.format!==1||fmt.bits!==16||![1,2].includes(fmt.channels)||fmt.sampleRate<8000||fmt.sampleRate>48000||fmt.align!==fmt.channels*2||fmt.byteRate!==fmt.sampleRate*fmt.align||!data.len||data.len%fmt.align) fail();
  const durationSeconds=data.len/fmt.byteRate;
  if(Math.abs(durationSeconds-expectedSeconds)>1) fail();
  let peak=0,sum=0;
  for(let i=data.start;i<data.end;i+=2){const v=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
  const rms=Math.sqrt(sum/(data.len/2));
  if(rms<0.0001) fail();
  return {audioVerified:true,format:'PCM16',channels:fmt.channels,sampleRate:fmt.sampleRate,durationSeconds,peak,rms,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
}
export function sonicResultUrl(file,origin,root){
  if(typeof root!=='string'||!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(root)) throw Error('sonic_output_root_required');
  if(typeof file!=='string'||file.length>2048||!file.startsWith('/v1/audio?')) throw Error('sonic_invalid_result_url');
  const url=new URL(file,origin);
  const paths=url.searchParams.getAll('path');
  if(url.origin!==origin||url.pathname!=='/v1/audio'||url.hash||paths.length!==1||[...url.searchParams.keys()].length!==1) throw Error('sonic_invalid_result_url');
  const path=paths[0];
  if(!path.startsWith(root+'/')||!/^[A-Za-z0-9_-]+\.wav$/.test(path.slice(root.length+1))) throw Error('sonic_invalid_result_path');
  return url;
}
