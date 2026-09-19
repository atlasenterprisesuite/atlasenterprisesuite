import type { VoiceNavigationAction } from './voiceActions';

export type VoiceRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type VoiceSideEffect = 'none' | 'reversible' | 'irreversible';
export type VoiceCostClass = 'none' | 'metered';

export type VoiceActionProposal = {
  id: string;
  kind: 'navigate' | 'tool';
  label: string;
  riskLevel: VoiceRiskLevel;
  sideEffect: VoiceSideEffect;
  costClass: VoiceCostClass;
  requiresApproval?: boolean;
  route?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
};

export type VoiceActionDecision = {
  outcome: 'allow' | 'confirm' | 'approval' | 'deny';
  reason: string;
  proposal: VoiceActionProposal;
};

export function navigationVoiceAction(action: VoiceNavigationAction): VoiceActionProposal {
  return {
    id: `navigate:${action.route}`,
    kind: 'navigate',
    label: action.label,
    route: action.route,
    riskLevel: 'low',
    sideEffect: 'none',
    costClass: 'none'
  };
}

export function evaluateVoiceActionProposal(proposal: VoiceActionProposal): VoiceActionDecision {
  if (!proposal.id || !proposal.label) {
    return { outcome: 'deny', reason: 'invalid_voice_action', proposal };
  }

  if (proposal.kind === 'navigate' && !proposal.route) {
    return { outcome: 'deny', reason: 'navigation_route_required', proposal };
  }

  if (proposal.kind === 'tool' && !proposal.toolName) {
    return { outcome: 'deny', reason: 'tool_name_required', proposal };
  }

  if (
    proposal.requiresApproval
    || proposal.riskLevel === 'high'
    || proposal.riskLevel === 'critical'
    || proposal.sideEffect === 'irreversible'
    || proposal.costClass === 'metered'
  ) {
    return {
      outcome: 'approval',
      reason: proposal.costClass === 'metered'
        ? 'cost_or_sensitive_action_requires_approval'
        : 'sensitive_action_requires_approval',
      proposal
    };
  }

  if (proposal.riskLevel === 'medium' || proposal.sideEffect === 'reversible') {
    return {
      outcome: 'confirm',
      reason: 'reversible_action_requires_confirmation',
      proposal
    };
  }

  if (
    proposal.riskLevel === 'low'
    && proposal.sideEffect === 'none'
    && proposal.costClass === 'none'
  ) {
    return { outcome: 'allow', reason: 'voice_policy_allowed', proposal };
  }

  return { outcome: 'deny', reason: 'voice_policy_denied', proposal };
}
