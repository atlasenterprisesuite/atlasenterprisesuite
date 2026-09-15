import type { MotionCompositionSpec, MotionLayer, MotionKeyframe } from './types';
import { validateMotionComposition } from './validator';

export type MotionOperation =
  | { type: 'layer.add'; layer: MotionLayer }
  | { type: 'layer.delete'; layerId: string }
  | { type: 'layer.update'; layerId: string; patch: Partial<Pick<MotionLayer,'name'|'visible'|'locked'|'transform'|'expression'>> }
  | { type: 'keyframe.add'; layerId: string; trackId: string; keyframe: MotionKeyframe }
  | { type: 'keyframe.delete'; layerId: string; trackId: string; keyframeId: string };

export function applyMotionOperations(input: MotionCompositionSpec, operations: MotionOperation[]): MotionCompositionSpec {
  const next: MotionCompositionSpec = structuredClone(input);
  for (const op of operations) {
    if (op.type === 'layer.add') { if (next.layers.some(l=>l.id===op.layer.id)) throw new Error('Duplicate layer'); next.layers.push(structuredClone(op.layer)); continue; }
    const layer = next.layers.find(l=>l.id===op.layerId);
    if (op.type === 'layer.delete') { if (!layer) throw new Error('Layer not found'); next.layers = next.layers.filter(l=>l.id!==op.layerId); continue; }
    if (!layer) throw new Error('Layer not found');
    if (layer.locked) throw new Error('Layer is locked');
    if (op.type === 'layer.update') { Object.assign(layer, structuredClone(op.patch)); continue; }
    const track = layer.tracks.find(t=>t.id===op.trackId); if (!track) throw new Error('Track not found');
    if (op.type === 'keyframe.add') { if (track.keyframes.some(k=>k.id===op.keyframe.id)) throw new Error('Duplicate keyframe'); track.keyframes.push(structuredClone(op.keyframe)); }
    else { if (!track.keyframes.some(k=>k.id===op.keyframeId)) throw new Error('Keyframe not found'); track.keyframes = track.keyframes.filter(k=>k.id!==op.keyframeId); }
  }
  if (validateMotionComposition(next).some(i=>i.severity==='blocking')) throw new Error('Motion operations produced an invalid composition');
  return next;
}
