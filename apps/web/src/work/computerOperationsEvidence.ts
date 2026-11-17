import type { ComputerOperationsProbe } from './computerOperations';

export type ComputerOperationsEvidence = {
  schemaVersion: 1;
  source: 'browser-route-probes';
  observedAt: string;
  scope: 'essential' | 'full';
  outcome: 'passed' | 'attention-required' | 'incomplete';
  productionVerified: false;
  nextAction: string;
  routes: Array<Omit<ComputerOperationsProbe, 'error'>>;
};

export function buildComputerOperationsEvidence(
  probes: ComputerOperationsProbe[],
  scope: ComputerOperationsEvidence['scope'],
  observedAt: string
): ComputerOperationsEvidence {
  const failed = probes.some((probe) => probe.state === 'fail' || probe.state === 'unavailable'
    || (probe.state === 'pass' && probe.status !== 200));
  const complete = probes.length > 0 && probes.every((probe) => probe.state === 'pass' && probe.status === 200);
  const outcome = failed ? 'attention-required' : complete ? 'passed' : 'incomplete';
  return {
    schemaVersion: 1,
    source: 'browser-route-probes',
    observedAt,
    scope,
    outcome,
    productionVerified: false,
    nextAction: failed
      ? 'Retry the critical checks and inspect failing routes. HTTP failures alone do not identify a DNS, firewall or provider cause.'
      : complete
        ? 'Browser checks passed. Run the canonical exact-SHA production verifier before declaring a release verified.'
        : 'Run the critical checks on the canonical production origin to collect evidence.',
    routes: probes.map(({ path, group, state, status, durationMs }) => ({ path, group, state, status, durationMs }))
  };
}
