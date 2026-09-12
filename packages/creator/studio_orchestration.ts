export type StudioAgentId = 'chatgpt' | 'gemini' | 'codex-sovereign';
export type StudioAgentState = 'verified' | 'configuration-required' | 'unavailable' | 'error';
export type StudioResponsibility = 'creative-direction' | 'multimodal-review' | 'technical-verification';

export type StudioAgentStatus = {
  id: StudioAgentId;
  state: StudioAgentState;
  responsibility: StudioResponsibility;
  mayMutateProduction: false;
  mayAuthorizeRender: false;
  mayAuthorizeCost: false;
};

export type StudioOrchestrationPlan = {
  agents: StudioAgentStatus[];
  canonicalOwner: 'atlas-studio-orchestrator';
  renderAuthorization: 'human-required';
  costAuthorization: 'human-required';
  reconciliation: 'deterministic-production-spec';
};

const RESPONSIBILITY: Record<StudioAgentId, StudioResponsibility> = {
  chatgpt: 'creative-direction',
  gemini: 'multimodal-review',
  'codex-sovereign': 'technical-verification',
};

const ORDER: StudioAgentId[] = ['chatgpt', 'gemini', 'codex-sovereign'];

export function canAgentAuthorizeRender(_agentId: StudioAgentId): false {
  return false;
}

export function buildStudioOrchestrationPlan(
  states: Partial<Record<StudioAgentId, StudioAgentState>>,
): StudioOrchestrationPlan {
  return {
    agents: ORDER.map((id) => ({
      id,
      state: states[id] ?? 'configuration-required',
      responsibility: RESPONSIBILITY[id],
      mayMutateProduction: false,
      mayAuthorizeRender: false,
      mayAuthorizeCost: false,
    })),
    canonicalOwner: 'atlas-studio-orchestrator',
    renderAuthorization: 'human-required',
    costAuthorization: 'human-required',
    reconciliation: 'deterministic-production-spec',
  };
}
