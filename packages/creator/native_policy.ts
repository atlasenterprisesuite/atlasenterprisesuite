export type NativeRenderGateInput = {
  permissions: readonly string[];
  dirty: boolean;
  validationStatus: 'pass' | 'warning' | 'blocking';
  aspectRatio: string;
  audioEnabled: boolean;
  motionCompositionPresent?: boolean;
  nativeCapabilities?: readonly string[];
};

export type NativeRenderGate = {
  allowed: boolean;
  reasons: string[];
  billingClass: 'zero-cost';
  execution: 'self-hosted';
  humanApprovalRequired: true;
};

const SUPPORTED_RATIOS = new Set(['9:16', '16:9', '1:1']);
const MOTION_CAPABILITY = 'motion-composition-v1';

export function evaluateNativeRenderGate(input: NativeRenderGateInput): NativeRenderGate {
  const reasons: string[] = [];
  const canGenerate = input.permissions.includes('creator.admin') || input.permissions.includes('creator.generate');
  if (!canGenerate) reasons.push('generation_permission_required');
  if (input.dirty) reasons.push('unsaved_changes');
  if (input.validationStatus === 'blocking') reasons.push('production_blocked');
  if (!input.audioEnabled) reasons.push('audio_required_for_native_narrated_render');
  if (!SUPPORTED_RATIOS.has(input.aspectRatio)) reasons.push('native_aspect_ratio_unsupported');
  if (input.motionCompositionPresent && !(input.nativeCapabilities ?? []).includes(MOTION_CAPABILITY)) {
    reasons.push('native_motion_capability_required');
  }
  return {
    allowed: reasons.length === 0,
    reasons,
    billingClass: 'zero-cost',
    execution: 'self-hosted',
    humanApprovalRequired: true
  };
}
