import type { SonicScore, SonicNote } from './sonic_engine';

const PPQ = 480;
const voices = ['bass','harmony','lead'] as const;
const programs = [33, 0, 81];
const int = (v:number,min:number,max:number) => Number.isInteger(v) && v>=min && v<=max;
function validate(score:SonicScore) {
  if (!Number.isFinite(score.duration) || score.duration<=0 || score.duration>32 ||
      !Array.isArray(score.notes) || score.notes.length>88 ||
      score.notes.some(n => !n || !voices.includes(n.voice) || !int(n.midi,24,108) ||
        !Number.isFinite(n.start) || n.start<0 || !Number.isFinite(n.duration) ||
        n.duration<=0 || n.start+n.duration>score.duration+1e-8)) throw new Error('Invalid score');
}
export function editSonicPitch(score:SonicScore,index:number,midi:number):SonicScore {
  validate(score);
  if (!int(index,0,score.notes.length-1) || !int(midi,24,108)) throw new Error('Invalid pitch edit');
  return {...score,notes:score.notes.map((n,i)=>i===index?{...n,midi}:n)};
}
function vlq(value:number):number[] {
  if (!int(value,0,0x0fffffff)) throw new Error('Invalid MIDI delta');
  const bytes=[value&127];
  while ((value>>>=7)>0) bytes.unshift((value&127)|128);
  return bytes;
}
const be32=(n:number)=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const track=(data:number[])=>[77,84,114,107,...be32(data.length),...data];
type Event={tick:number;order:number;data:number[]};
export function renderSonicMidi(score:SonicScore,bpm:number):Uint8Array {
  validate(score);
  if (!int(bpm,60,180)) throw new Error('Invalid tempo');
  const us=Math.round(60000000/bpm);
  const ticks=(seconds:number)=>Math.round(seconds*bpm*PPQ/60);
  const total=ticks(score.duration);
  const conductor=track([0,255,81,3,(us>>>16)&255,(us>>>8)&255,us&255,
    0,255,88,4,4,2,24,8,...vlq(total),255,47,0]);
  const instrumentTracks=voices.map((voice,channel)=>{
    const events:Event[]=[];
    const intervals=new Map<number,{start:number;end:number}[]>();
    for(const n of score.notes.filter((item:SonicNote)=>item.voice===voice)){
      const start=ticks(n.start),end=Math.max(start+1,ticks(n.start+n.duration));
      if(end>total) throw new Error('Note exceeds MIDI duration');
      const list=intervals.get(n.midi)??[];
      list.push({start,end});intervals.set(n.midi,list);
    }
    // Merge overlapping equal-pitch intervals to avoid premature note-off.
    for(const [pitch,list] of intervals){
      const merged:{start:number;end:number}[]=[];
      for(const interval of list.sort((a,b)=>a.start-b.start)){
        const last=merged[merged.length-1];
        if(last && interval.start<last.end) last.end=Math.max(last.end,interval.end);
        else merged.push({...interval});
      }
      for(const n of merged){
        events.push({tick:n.start,order:1,data:[0x90|channel,pitch,72]});
        events.push({tick:n.end,order:0,data:[0x80|channel,pitch,0]});
      }
    }
    events.sort((a,b)=>a.tick-b.tick||a.order-b.order||a.data[1]-b.data[1]);
    const data=[0,0xc0|channel,programs[channel]];
    let previous=0;
    for(const event of events){data.push(...vlq(event.tick-previous),...event.data);previous=event.tick;}
    data.push(...vlq(total-previous),255,47,0);
    return track(data);
  });
  return Uint8Array.from([77,84,104,100,0,0,0,6,0,1,0,4,1,224,...conductor,...instrumentTracks.flat()]);
}
