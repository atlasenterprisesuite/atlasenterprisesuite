import type { MotionCompositionSpec, MotionValidationIssue } from './types.ts';
import { isAllowedDataSourceUrl } from './data_reel.ts';

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
  if (spec.template === 'data-reel-v1') {
    const facts = spec.layers.filter(layer => layer.dataReelRole === 'value');
    if (typeof spec.dataReelCount !== 'number' || !Number.isInteger(spec.dataReelCount) || !facts.length || facts.length !== spec.dataReelCount) {
      issues.push({ code: 'motion.data_reel_count_mismatch', severity: 'blocking', message: 'Data reel metrics must match the original sourced data point count.', targetId: spec.id });
    }
    for (const fact of facts) {
      if (!fact.sourceUrl || !isAllowedDataSourceUrl(fact.sourceUrl)) {
        issues.push({ code: 'motion.data_reel_source_invalid', severity: 'blocking', message: 'A data reel fact must retain a valid HTTPS source reference.', targetId: fact.id });
      }
      if (!fact.sourceClaim || fact.name !== fact.sourceClaim) {
        issues.push({ code: 'motion.data_reel_claim_changed', severity: 'blocking', message: 'A data reel fact was edited; regenerate with an updated source attribution.', targetId: fact.id });
      }
      const attribution = spec.layers.find(layer =>
        layer.dataReelRole === 'source' && layer.sourceUrl === fact.sourceUrl &&
        layer.startSecond === fact.startSecond && layer.endSecond === fact.endSecond && layer.visible
      );
      if (!attribution) issues.push({ code: 'motion.data_reel_source_missing', severity: 'blocking', message: 'A visible source attribution is required for each fact.', targetId: fact.id });
      if (attribution && fact.sourceUrl && isAllowedDataSourceUrl(fact.sourceUrl) &&
          attribution.name !== `Source supplied (unverified): ${new URL(fact.sourceUrl).hostname}`) {
        issues.push({ code: 'motion.data_reel_source_changed', severity: 'blocking', message: 'Source attribution text was changed and must be regenerated.', targetId: attribution.id });
      }
    }
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
