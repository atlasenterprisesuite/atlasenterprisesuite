/** Reproducible IMT-2030-oriented simulation experiments; NOT 6G conformance. */
import { simulateScenario } from './atlas-6g-pioneer.mjs';

export const STUDY_MAX_SCENARIOS = 32;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const allowed = new Set(['offeredMbps', 'capacityMbps', 'baseLatencyMs', 'jitterMs', 'durationSeconds']);

/**
 * Runs a bounded, offline, synthetic scenario suite.
 * No RF, personal data, SIM profiles, network provisioning or telecom APIs.
 * Any thresholds passed by a caller are experimental targets, not ITU acceptance criteria.
 */
export function runImt2030Study(input) {
  if (!isRecord(input) || !Array.isArray(input.scenarios) ||
      input.scenarios.length < 1 || input.scenarios.length > STUDY_MAX_SCENARIOS) {
    throw new RangeError('scenarios must contain 1-32 entries');
  }
  const scenarios = input.scenarios.map((scenario, index) => {
    if (!isRecord(scenario) || Object.keys(scenario).some((key) => !allowed.has(key))) {
      throw new TypeError('scenario contains unknown fields or is not an object');
    }
    const output = simulateScenario(scenario);
    return Object.freeze({ index, ...output });
  });
  const aggregate = Object.freeze({
    scenarioCount: scenarios.length,
    meanDeliveredMbps: scenarios.reduce((sum, x) => sum + x.deliveredMbps, 0) / scenarios.length,
    maximumModeledLatencyMs: Math.max(...scenarios.map((x) => x.modeledLatencyMs)),
    maximumEstimatedLossPercent: Math.max(...scenarios.map((x) => x.estimatedLossPercent))
  });
  return Object.freeze({
    project: 'ATLAS IMT-2030 Research Lab',
    standardsFramework: 'ITU-R M.2160',
    mode: 'synthetic_research_only',
    evidenceClass: 'simulation_not_measurement',
    complianceStatus: 'not_assessed',
    observed: false,
    radioTransmissions: false,
    subscriberActivationAllowed: false,
    commercial6gAvailable: false,
    aggregate,
    scenarios: Object.freeze(scenarios)
  });
}

/** Read-only second-number service intent; never generates a phone number or eSIM credentials. */
export function planSecondLine(input = {}) {
  if (!isRecord(input)) throw new TypeError('line request must be an object');
  if (input.activate === true || input.provision === true || input.payment === true) {
    throw new Error('activation, provisioning and payments require an authorized carrier workflow');
  }
  return Object.freeze({
    intent: 'new_number',
    platform: 'ATLAS Wireless',
    requestedCapabilities: Object.freeze(['voice', 'sms', 'mobile_data', 'esim']),
    physicalNetwork: 'authorized_carrier_required',
    mobileDataTechnology: 'carrier_4g_or_5g_only',
    carrierVerified: false,
    numberAssigned: false,
    esimIssued: false,
    activationAllowed: false,
    accountChargeAuthorized: false,
    nextStep: 'select_authorized_carrier_and_verify_device_eligibility'
  });
}
