import { describe, expect, it } from 'vitest';
import { buildStudioOrchestrationPlan, canAgentAuthorizeRender } from '../../packages/creator/studio_orchestration';

describe('ATLAS Studio sovereign orchestra', () => {
  it('keeps render authorization human-only for every AI agent', () => {
    for (const id of ['chatgpt', 'gemini', 'codex-sovereign'] as const) {
      expect(canAgentAuthorizeRender(id)).toBe(false);
    }
  });

  it('does not fake readiness for an unverified agent', () => {
    const plan = buildStudioOrchestrationPlan({
      chatgpt: 'verified',
      gemini: 'configuration-required',
      'codex-sovereign': 'verified'
    });
    expect(plan.agents.map(agent => agent.id)).toEqual(['chatgpt', 'gemini', 'codex-sovereign']);
    expect(plan.agents.find(agent => agent.id === 'gemini')?.state).toBe('configuration-required');
    expect(plan.renderAuthorization).toBe('human-required');
    expect(plan.costAuthorization).toBe('human-required');
  });

  it('separates creative direction, multimodal review and technical verification', () => {
    const plan = buildStudioOrchestrationPlan({
      chatgpt: 'verified',
      gemini: 'verified',
      'codex-sovereign': 'verified'
    });
    expect(plan.agents[0].responsibility).toBe('creative-direction');
    expect(plan.agents[1].responsibility).toBe('multimodal-review');
    expect(plan.agents[2].responsibility).toBe('technical-verification');
  });
});
