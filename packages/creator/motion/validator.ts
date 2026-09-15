import type { MotionCompositionSpec, MotionValidationIssue } from './types';

export function validateMotionComposition(spec: MotionCompositionSpec): MotionValidationIssue[] {
  const issues: MotionValidationIssue[] = [];
  const ids = new Set<string>();
  if (!(spec.width > 0 && spec.height > 0 && spec.fps > 0 && spec.durationSeconds > 0)) issues.push({ code: 'motion.invalid_composition', severity: 'blocking', message: 'Dimensions, fps and duration must be positive.', targetId: spec.id });
  for (const layer of spec.layers) {
    if (ids.has(layer.id)) issues.push({ code: 'motion.duplicate_layer_id', severity: 'blocking', message: `Duplicate layer id ${layer.id}.`, targetId: layer.id });
    ids.add(layer.id);
    if (layer.startSecond < 0 || layer.endSecond > spec.durationSeconds || layer.endSecond < layer.startSecond) issues.push({ code: 'motion.layer_out_of_range', severity: 'blocking', message: 'Layer timing is outside the composition.', targetId: layer.id });
    for (const track of layer.tracks) for (const keyframe of track.keyframes) if (keyframe.time < layer.startSecond || keyframe.time > layer.endSecond) issues.push({ code: 'motion.keyframe_out_of_range', severity: 'blocking', message: 'Keyframe is outside its layer timing.', targetId: keyframe.id });
  }
  const byId = new Map(spec.layers.map(layer => [layer.id, layer]));
  for (const layer of spec.layers) {
    const seen = new Set<string>([layer.id]);
    let parent = layer.parentLayerId;
    while (parent) {
      if (seen.has(parent)) { issues.push({ code: 'motion.parent_cycle', severity: 'blocking', message: 'Layer parenting contains a cycle.', targetId: layer.id }); break; }
      seen.add(parent);
      const parentLayer = byId.get(parent);
      if (!parentLayer) { issues.push({ code: 'motion.parent_missing', severity: 'blocking', message: 'Parent layer does not exist.', targetId: layer.id }); break; }
      parent = parentLayer.parentLayerId;
    }
  }
  return issues;
}
