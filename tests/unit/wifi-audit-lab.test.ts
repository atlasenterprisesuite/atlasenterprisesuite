import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assessWifiLabFixture } from '../../packages/security/src/wifiAuditLab.mjs';

const fixture = {
  scope: 'synthetic-lab', orgId: 'organization-test', actorOrgId: 'organization-test',
  permission: 'wifi.security.assess', explicitAuthorization: true,
  evidenceRef: 'fixture:example-01', protocol: 'wpa3-personal',
  wpsEnabled: false, firmwareCurrent: true
};

describe('ATLAS Wi-Fi lab verification (no radio/network I/O)', () => {
  it('matches the RFC 6070 PBKDF2-HMAC-SHA1 4096-iteration reference', () => {
    expect(pbkdf2Sync('password', 'salt', 4096, 20, 'sha1').toString('hex'))
      .toBe('4b007901b765489abead49d926f721d065a429c1');
  });
  it('reproduces a deterministic WPA2-Personal PMK derivation fixture', () => {
    expect(pbkdf2Sync('password', 'IEEE', 4096, 32, 'sha1').toString('hex'))
      .toBe('f42c6fc52df0ebef9ebb4b90b38a5f902e83fe1b135a70e23aed762e9710a12e');
  });
  it('different SSIDs produce different keys for an identical lab passphrase', () => {
    const a = pbkdf2Sync('password', 'IEEE', 4096, 32, 'sha1').toString('hex');
    const b = pbkdf2Sync('password', 'Other-Lab', 4096, 32, 'sha1').toString('hex');
    expect(a).not.toBe(b);
  });
  it('blocks missing or malformed input', () => {
    expect(assessWifiLabFixture(null).state).toBe('blocked');
    expect(assessWifiLabFixture({}).state).toBe('blocked');
  });
  it('fails closed on a non-lab scope or mismatched tenant', () => {
    expect(assessWifiLabFixture({ ...fixture, scope: 'real-wifi' }).reason).toBe('live_network_not_supported');
    expect(assessWifiLabFixture({ ...fixture, actorOrgId: 'another-organization' }).reason).toBe('tenant_scope_mismatch');
  });
  it('blocks absent lab consent and wrong declared lab permission', () => {
    expect(assessWifiLabFixture({ ...fixture, explicitAuthorization: false }).reason).toBe('authorization_required');
    expect(assessWifiLabFixture({ ...fixture, permission: 'anonymous' }).reason).toBe('authorization_required');
  });
  it('never accepts passwords, raw captures, or unexpected fields in the lab assessment', () => {
    expect(assessWifiLabFixture({ ...fixture, password: 'do-not-store' }).reason).toBe('unexpected_or_sensitive_field');
    expect(assessWifiLabFixture({ ...fixture, capture: 'test.pcap' }).state).toBe('blocked');
  });
  it('requires synthetic provenance and explicit configuration booleans', () => {
    expect(assessWifiLabFixture({ ...fixture, evidenceRef: 'real-device' }).reason).toBe('synthetic_evidence_required');
    expect(assessWifiLabFixture({ ...fixture, wpsEnabled: undefined }).reason).toBe('configuration_data_required');
  });
  it('flags deprecated WEP and open networks as critical', () => {
    expect(assessWifiLabFixture({ ...fixture, protocol: 'wep' }).risk).toBe('critical');
    expect(assessWifiLabFixture({ ...fixture, protocol: 'open' }).risk).toBe('critical');
  });
  it('flags WPA2/WPA3 transition and WPS enablement without claiming cracking capability', () => {
    expect(assessWifiLabFixture({ ...fixture, protocol: 'wpa2-wpa3-transition' }).risk).toBe('elevated');
    expect(assessWifiLabFixture({ ...fixture, wpsEnabled: true }).risk).toBe('elevated');
  });
  it('flags out-of-date firmware even with WPA3-only', () => {
    expect(assessWifiLabFixture({ ...fixture, firmwareCurrent: false }).risk).toBe('elevated');
  });
  it('never claims a lab result is production verification', () => {
    const result = assessWifiLabFixture(fixture);
    expect(result.state).toBe('assessed_lab_fixture');
    expect(result.productionVerified).toBe(false);
    expect(result.mode).toBe('offline-fixture-only');
  });
});
