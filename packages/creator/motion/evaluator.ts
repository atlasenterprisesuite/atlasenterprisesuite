import type { MotionTrack, MotionValue } from './types';

function ease(type: string, t: number): number {
  if (type === 'ease-in') return t * t;
  if (type === 'ease-out') return 1 - (1 - t) * (1 - t);
  if (type === 'ease-in-out') return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
  return t;
}

function interpolate(a: MotionValue, b: MotionValue, t: number): MotionValue {
  if (typeof a === 'number' && typeof b === 'number') return a + (b-a)*t;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v,i) => v + (b[i]-v)*t);
  return t < 1 ? a : b;
}

export function evaluateTrack(track: MotionTrack, time: number): MotionValue | undefined {
  const frames = [...track.keyframes].sort((a,b) => a.time-b.time);
  if (!frames.length) return undefined;
  if (time <= frames[0].time) return frames[0].value;
  if (time >= frames[frames.length-1].time) return frames[frames.length-1].value;
  for (let i=0;i<frames.length-1;i++) {
    const a=frames[i], b=frames[i+1];
    if (time >= a.time && time <= b.time) {
      const span=b.time-a.time;
      const raw=span === 0 ? 1 : (time-a.time)/span;
      return interpolate(a.value,b.value,ease(a.easing.type,Math.max(0,Math.min(1,raw))));
    }
  }
  return undefined;
}
