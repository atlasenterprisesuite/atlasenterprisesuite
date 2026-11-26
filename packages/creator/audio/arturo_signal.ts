/** Educational offline codec; no radio, receiver, or extraterrestrial contact. */
const alphabet = [60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75];
function checksum(bytes: Uint8Array): number {
  let crc=0xffff;
  for(const byte of bytes){
    crc ^= byte << 8;
    for(let i=0;i<8;i++) crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;
  }
  return crc;
}
export function encodeArturo(message:string):number[]{
  if(typeof message!=='string')throw Error('Invalid message');
  const bytes=new TextEncoder().encode(message);
  if(!bytes.length||bytes.length>32)throw Error('Message must contain 1–32 UTF-8 bytes');
  const crc=checksum(bytes);
  const frame=[77,79,77,79];
  for(const byte of [bytes.length,...bytes,crc>>8,crc&255])frame.push(alphabet[byte>>4],alphabet[byte&15]);
  return frame;
}
export function decodeArturo(frame:readonly number[]):string{
  if(!Array.isArray(frame)||frame.length<12||frame.length>74||frame.length%2!==0||frame.slice(0,4).join(',')!=='77,79,77,79')throw Error('Invalid frame');
  const bytes:number[]=[];
  for(let i=4;i<frame.length;i+=2){
    const a=alphabet.indexOf(frame[i]),b=alphabet.indexOf(frame[i+1]);
    if(a<0||b<0)throw Error('Invalid symbol');
    bytes.push(a*16+b);
  }
  const length=bytes[0];
  if(length<1||length>32||bytes.length!==length+3)throw Error('Invalid length');
  const payload=Uint8Array.from(bytes.slice(1,-2));
  if(checksum(payload)!==((bytes[bytes.length-2]<<8)|bytes[bytes.length-1]))throw Error('Checksum mismatch');
  return new TextDecoder('utf-8',{fatal:true}).decode(payload);
}
export function simulateArturo(frame:readonly number[],errorRate:number,seed:number){
  decodeArturo(frame);
  if(!Number.isFinite(errorRate)||errorRate<0||errorRate>1||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid simulation settings');
  let state=seed>>>0, errors=0;
  const observed=frame.map((pitch,i)=>{
    if(i<4)return pitch;
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    if(state/4294967296>=errorRate)return pitch;
    errors++;
    return 60+((pitch-60+1)%16);
  });
  let decoded:string|null=null;
  try{decoded=decodeArturo(observed);}catch{/* corrupted frame */}
  return {source:'synthetic' as const,transmitted:false,receivedFromSpace:false,errors,decoded};
}
