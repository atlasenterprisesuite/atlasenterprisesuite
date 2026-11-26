import { encodeArturo, decodeArturo } from './arturo_signal';

function bounded(n:number,max:number){
  if(!Number.isInteger(n)||n<0||n>max)throw Error('Invalid UCP symbol');
}
export function encodeNibble(value:number):number{
  bounded(value,15);
  const a=(value>>3)&1,b=(value>>2)&1,c=(value>>1)&1,d=value&1;
  const bits=[a^b^d,a^c^d,a,b^c^d,b,c,d];
  bits.push(bits.reduce((x,y)=>x^y,0));
  return bits.reduce((word,bit,i)=>word|(bit<<i),0);
}
export function decodeNibble(word:number):{value:number;corrected:boolean}{
  bounded(word,255);
  const b=Array.from({length:8},(_,i)=>(word>>i)&1);
  const syndrome=(b[0]^b[2]^b[4]^b[6])+2*(b[1]^b[2]^b[5]^b[6])+4*(b[3]^b[4]^b[5]^b[6]);
  const parity=b.reduce((x,y)=>x^y,0);
  if(syndrome&&!parity)throw Error('Double error detected');
  if(parity)b[syndrome?syndrome-1:7]^=1;
  return {value:8*b[2]+4*b[4]+2*b[5]+b[6],corrected:!!parity};
}
// Protect the existing ARTURO payload (including length and CRC), not a second framing protocol.
export function encodeUcp(message:string):number[]{
  return encodeArturo(message).slice(4).map(pitch=>encodeNibble(pitch-60));
}
export function decodeUcp(words:readonly number[]):string{
  if(!Array.isArray(words)||words.length<8||words.length>70||words.length%2)throw Error('Invalid UCP frame');
  return decodeArturo([77,79,77,79,...words.map(word=>60+decodeNibble(word).value)]);
}
// Three distinct caller-managed channels; two independently decoded, identical messages required.
// No authentication, physical synchronization, or protection against correlated malicious input is implied.
export function fuseUcp(channels:readonly (readonly number[]|null)[]):string{
  if(!Array.isArray(channels)||channels.length!==3)throw Error('Expected three channels');
  const votes=new Map<string,number>();
  for(const channel of channels){
    if(channel===null)continue;
    try{const message=decodeUcp(channel);votes.set(message,(votes.get(message)??0)+1);}catch{/* erasure */}
  }
  for(const [message,count] of votes)if(count>=2)return message;
  throw Error('No channel quorum');
}
