import { encodeUcp, decodeUcp } from './ucp777';

export const vocabulary = Object.freeze(['0','1','2','3','4','5','6','7','8','9','add','subtract','multiply','divide','equal','different','greater','less','point','line','circle','triangle','square','time','distance','frequency','energy','mass','start','end','ack','error'] as const);
export type Concept = typeof vocabulary[number];
export type Channel = 'math'|'music'|'geometry'|'light'|'vibration';
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUV';
// One ASCII version byte plus at most 31 symbols per canonical UCP frame.
// Longer sequences are returned as ordered frame arrays; transport must preserve order.
export function encodeConcepts(concepts:readonly Concept[]):number[][]{
  if(!Array.isArray(concepts)||!concepts.length||concepts.length>32)throw Error('Invalid concept sequence');
  const symbols=concepts.map(c=>{const i=vocabulary.indexOf(c);if(i<0)throw Error('Unknown concept');return alphabet[i];}).join('');
  return Array.from({length:Math.ceil(symbols.length/16)},(_,i)=>encodeUcp('1'+String(i)+String(Math.ceil(symbols.length/16))+symbols.slice(i*16,(i+1)*16)));
}
export function decodeConcepts(frames:readonly (readonly number[])[]):Concept[]{
  if(!Array.isArray(frames)||!frames.length||frames.length>2)throw Error('Invalid dictionary frames');
  const symbols=frames.map((frame,i)=>{
    const text=decodeUcp(frame);
    if(text.slice(0,3)!=='1'+String(i)+String(frames.length)||text.length<4||text.length>19||(i<frames.length-1&&text.length!==19))throw Error('Invalid dictionary version or sequence');
    return text.slice(3);
  }).join('');
  return Array.from(symbols,s=>{const i=alphabet.indexOf(s);if(i<0)throw Error('Unknown symbol');return vocabulary[i];});
}
export function representSymbol(i:number,channel:Channel):number[]{
  if(!Number.isInteger(i)||i<0||i>31)throw Error('Invalid symbol');
  const bits=Array.from({length:5},(_,j)=>(i>>(4-j))&1);
  switch(channel){
    case 'math':return [i];
    case 'music':return [60+(i>>4),60+(i&15)];
    case 'geometry':return [i+1];
    case 'light':return bits;
    case 'vibration':return bits.map(b=>b+1);
    default:throw Error('Unknown channel');
  }
}
export function recoverSymbol(values:readonly number[],channel:Channel):number{
  if(!Array.isArray(values))throw Error('Invalid representation');
  for(let i=0;i<32;i++){const expected=representSymbol(i,channel);if(expected.length===values.length&&expected.every((v,j)=>v===values[j]))return i;}
  throw Error('Invalid representation');
}
