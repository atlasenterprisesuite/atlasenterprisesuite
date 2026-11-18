/**
 * Offline ATLAS Wireless integration handshake planner.
 * Never sends requests to a carrier or writes to subscriber/provisioning state.
 * Real authorization must originate from a separately reviewed provider adapter.
 */
const record = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const STAGES = Object.freeze(['carrier_agreement', 'provisioning_contract', 'billing_compliance', 'emergency_services', 'device_eligibility', 'staging_e2e', 'production_review']);
const refs = (entry) => record(entry) &&
  entry.reviewed === true && typeof entry.reference === 'string' &&
  /^https:\/\/[a-zA-Z0-9.-]+\/.{1,250}$/.test(entry.reference) &&
  typeof entry.reviewerId === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(entry.reviewerId);
/**
 * Metadata checklist only. A supplied boolean is never proof of an operator
 * agreement and can never enable activation or external network access.
 */
export function assessCarrierIntegration(input = {}) {
  if (!record(input)) throw new TypeError('input must be an object');
  const evidence = record(input.evidence) ? input.evidence : {};
  const checks = STAGES.map(stage => Object.freeze({
    stage,
    metadataPresent: refs(evidence[stage]),
    externallyVerified: false
  }));
  return Object.freeze({
    mode: 'offline_authorization_preflight',
    integrationName: 'ATLAS Wireless',
    intendedService: 'second_number_voice_sms_data',
    checks: Object.freeze(checks),
    metadataComplete: checks.every(x => x.metadataPresent),
    operatorContractAuthenticated: false,
    provisionerAuthenticated: false,
    providerApiAccessAllowed: false,
    simProvisioningAllowed: false,
    numberReservationAllowed: false,
    chargesAllowed: false,
    subscriberActivationAllowed: false,
    liveRadioNetwork: false,
    requiresIndependentApproval: true
  });
}
export { STAGES as CARRIER_GATES };
