/**
 * ATLAS Carrier Lab 777
 *
 * Deterministic, offline-only simulation. This module never provisions a
 * subscriber, allocates a telephone number or connects to the PSTN.
 */
export type LabChannel = 'voice' | 'sms' | 'data' | 'esim';
export type LabScenario = 'success' | 'provider_unavailable' | 'timeout' | 'unauthorized';
export type LabOutcome = 'simulated_success' | 'simulated_failure';

export interface CarrierLabRequest {
  organizationId: string;
  actorId: string;
  seed: number;
  count: number;
  channel: LabChannel;
  scenario: LabScenario;
}

export interface CarrierLabEvent {
  id: string;
  organizationId: string;
  channel: LabChannel;
  scenario: LabScenario;
  outcome: LabOutcome;
  latencyMs: number;
  synthetic: true;
  providerEvidence: null;
  realNumber: null;
  esimProfile: null;
}

export interface CarrierLabReport {
  mode: 'simulation';
  productionReady: false;
  organizationId: string;
  channel: LabChannel;
  scenario: LabScenario;
  total: number;
  passed: number;
  failed: number;
  events: CarrierLabEvent[];
}

const MAX_EVENTS = 10000;
const CHANNELS: readonly LabChannel[] = ['voice', 'sms', 'data', 'esim'];
const SCENARIOS: readonly LabScenario[] = [
  'success', 'provider_unavailable', 'timeout', 'unauthorized'
];

function nextRandom(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function runCarrierLab(request: CarrierLabRequest): CarrierLabReport {
  if (!request.organizationId?.trim() || !request.actorId?.trim()) {
    throw new Error('carrier_lab_identity_required');
  }
  if (!Number.isSafeInteger(request.count) || request.count < 1 || request.count > MAX_EVENTS) {
    throw new Error('carrier_lab_count_invalid');
  }
  if (!Number.isSafeInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) {
    throw new Error('carrier_lab_seed_invalid');
  }
  if (!CHANNELS.includes(request.channel) || !SCENARIOS.includes(request.scenario)) {
    throw new Error('carrier_lab_scenario_invalid');
  }

  const events: CarrierLabEvent[] = [];
  let state = request.seed >>> 0;
  let passed = 0;
  for (let i = 0; i < request.count; i++) {
    state = nextRandom(state);
    const latencyMs = 10 + (state % 991);
    const outcome: LabOutcome = request.scenario === 'success'
      ? 'simulated_success'
      : 'simulated_failure';
    if (outcome === 'simulated_success') passed++;
    events.push({
      id: `lab-${request.seed}-${i}`,
      organizationId: request.organizationId,
      channel: request.channel,
      scenario: request.scenario,
      outcome,
      latencyMs,
      synthetic: true,
      providerEvidence: null,
      realNumber: null,
      esimProfile: null
    });
  }
  return {
    mode: 'simulation',
    productionReady: false,
    organizationId: request.organizationId,
    channel: request.channel,
    scenario: request.scenario,
    total: events.length,
    passed,
    failed: events.length - passed,
    events
  };
}
