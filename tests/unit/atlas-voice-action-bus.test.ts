import { describe, expect, it } from 'vitest';
import {
  evaluateVoiceActionProposal,
  navigationVoiceAction,
  type VoiceActionProposal
} from '../../apps/web/src/modules/voice/voiceActionBus';

describe('ATLAS Voice governed action bus', () => {
  it('allows low-risk navigation with no side effect or cost', () => {
    const decision = evaluateVoiceActionProposal(navigationVoiceAction({
      kind: 'navigate',
      route: '/payroll',
      label: 'Payroll',
      confirmation: 'Opening Payroll.'
    }));

    expect(decision).toMatchObject({
      outcome: 'allow',
      reason: 'voice_policy_allowed',
      proposal: { route: '/payroll', riskLevel: 'low', sideEffect: 'none', costClass: 'none' }
    });
  });

  it('requires confirmation for reversible medium-risk actions', () => {
    const proposal: VoiceActionProposal = {
      id: 'tool:update-draft',
      kind: 'tool',
      toolName: 'update_draft',
      label: 'Update draft',
      riskLevel: 'medium',
      sideEffect: 'reversible',
      costClass: 'none'
    };

    expect(evaluateVoiceActionProposal(proposal).outcome).toBe('confirm');
  });

  it.each([
    ['high risk', { riskLevel: 'high', sideEffect: 'reversible', costClass: 'none' }],
    ['critical risk', { riskLevel: 'critical', sideEffect: 'irreversible', costClass: 'none' }],
    ['irreversible side effect', { riskLevel: 'low', sideEffect: 'irreversible', costClass: 'none' }],
    ['metered cost', { riskLevel: 'low', sideEffect: 'none', costClass: 'metered' }]
  ] as const)('routes %s through Approval Center policy', (_name, policy) => {
    const proposal: VoiceActionProposal = {
      id: 'tool:governed',
      kind: 'tool',
      toolName: 'governed_tool',
      label: 'Governed tool',
      riskLevel: policy.riskLevel,
      sideEffect: policy.sideEffect,
      costClass: policy.costClass
    };

    expect(evaluateVoiceActionProposal(proposal).outcome).toBe('approval');
  });

  it('denies malformed tool proposals instead of guessing', () => {
    const proposal: VoiceActionProposal = {
      id: 'tool:missing',
      kind: 'tool',
      label: 'Missing tool',
      riskLevel: 'low',
      sideEffect: 'none',
      costClass: 'none'
    };

    expect(evaluateVoiceActionProposal(proposal)).toMatchObject({
      outcome: 'deny',
      reason: 'tool_name_required'
    });
  });
});
