/**
 * ATLAS Wi-Fi Security: offline, fixture-only configuration assessment.
 * This module performs no network I/O and never handles credentials or captures.
 * Caller-supplied consent and tenant fields are lab fixtures, NOT server authorization.
 */
const ALLOWED_FIELDS = new Set([
  'scope', 'orgId', 'actorOrgId', 'permission', 'explicitAuthorization',
  'evidenceRef', 'protocol', 'wpsEnabled', 'firmwareCurrent'
]);
const PROTOCOLS = new Set([
  'open', 'wep', 'wpa', 'wpa2-personal', 'wpa3-personal',
  'wpa2-wpa3-transition', 'wpa2-enterprise', 'wpa3-enterprise'
]);
const denied = (reason) => Object.freeze({ state: 'blocked', mode: 'offline-fixture-only', reason });

export function assessWifiLabFixture(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return denied('invalid_input');
  if (Object.keys(input).some((field) => !ALLOWED_FIELDS.has(field))) return denied('unexpected_or_sensitive_field');
  if (input.scope !== 'synthetic-lab') return denied('live_network_not_supported');
  if (typeof input.orgId !== 'string' || !input.orgId.trim() ||
      typeof input.actorOrgId !== 'string' || input.actorOrgId !== input.orgId) return denied('tenant_scope_mismatch');
  if (input.permission !== 'wifi.security.assess' || input.explicitAuthorization !== true) return denied('authorization_required');
  if (typeof input.evidenceRef !== 'string' || !/^fixture:[a-z0-9-]{1,64}$/.test(input.evidenceRef)) return denied('synthetic_evidence_required');
  if (!PROTOCOLS.has(input.protocol)) return denied('unsupported_protocol');
  if (typeof input.wpsEnabled !== 'boolean' || typeof input.firmwareCurrent !== 'boolean') return denied('configuration_data_required');

  const findings = [];
  let risk = 'review';
  if (input.protocol === 'open' || input.protocol === 'wep' || input.protocol === 'wpa') {
    risk = 'critical';
    findings.push('insecure_or_deprecated_protocol');
  } else if (input.protocol === 'wpa2-wpa3-transition') {
    risk = 'elevated';
    findings.push('wpa2_transition_exposure');
  } else if (input.protocol === 'wpa3-personal') {
    risk = 'low_configuration_risk';
    findings.push('sae_password_resistance_not_implementation_proof');
  } else {
    findings.push('additional_authentication_configuration_review_required');
  }
  if (input.wpsEnabled) {
    findings.push('wps_enabled_review_or_disable');
    if (risk !== 'critical') risk = 'elevated';
  }
  if (!input.firmwareCurrent) {
    findings.push('firmware_update_required');
    if (risk === 'low_configuration_risk' || risk === 'review') risk = 'elevated';
  }
  return Object.freeze({
    state: 'assessed_lab_fixture',
    mode: 'offline-fixture-only',
    risk,
    findings: Object.freeze(findings),
    source: input.evidenceRef,
    productionVerified: false
  });
}
