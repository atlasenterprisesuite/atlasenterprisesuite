/** ATLAS 6G Pioneer research-only engine. Synthetic results are never observed network metrics. */
export const REQUIREMENTS = Object.freeze([
  'standards_traceability','radio_testbed_authorization','device_capability_evidence',
  'interop_test_plan','security_privacy_review','measured_lab_results'
]);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
export function evaluateReadiness(evidence = {}) {
  if (evidence === null || Array.isArray(evidence) || typeof evidence !== 'object') throw new TypeError('evidence must be an object');
  const checks = REQUIREMENTS.map(key => {
    const entry = evidence[key];
    const verified = entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      && entry.verified === true && typeof entry.reference === 'string' && entry.reference.trim().length > 0
      && typeof entry.verifiedAt === 'string' && !Number.isNaN(Date.parse(entry.verifiedAt))
      && new Date(entry.verifiedAt).getTime() <= Date.now();
    return { requirement: key, verified, evidenceReference: verified ? entry.reference : null };
  });
  return { mode: 'research_only', evidenceComplete: checks.every(c=>c.verified),
    service6gReady: false, commercialActivationAllowed: false, checks };
}
export function simulateScenario(scenario) {
  if (scenario === null || typeof scenario !== 'object' || Array.isArray(scenario)) throw new TypeError('scenario must be an object');
  const { offeredMbps, capacityMbps, baseLatencyMs, jitterMs=0, durationSeconds=60 } = scenario;
  if (![offeredMbps,capacityMbps,baseLatencyMs,jitterMs,durationSeconds].every(finite)
    || offeredMbps < 0 || capacityMbps <= 0 || baseLatencyMs < 0 || jitterMs < 0
    || durationSeconds <= 0 || durationSeconds > 86400) throw new RangeError('invalid simulation inputs');
  const deliveredMbps = Math.min(offeredMbps,capacityMbps);
  const estimatedLossPercent = offeredMbps === 0 ? 0 : Math.max(0,100*(offeredMbps-deliveredMbps)/offeredMbps);
  const utilization = deliveredMbps/capacityMbps;
  // Heuristic only, not an RF or protocol-grade network model.
  const modeledLatencyMs = baseLatencyMs + jitterMs + (utilization >= 1 ? 20 : 5*utilization/(1-utilization));
  return { provenance: 'synthetic_model', networkGeneration: 'unspecified', model: 'simple_capacity_v1',
    observed: false, durationSeconds, offeredMbps, capacityMbps,
    deliveredMbps, estimatedLossPercent, modeledLatencyMs,
    warning: 'Illustrative capacity model only; not a 6G prediction or real network measurement.' };
}
