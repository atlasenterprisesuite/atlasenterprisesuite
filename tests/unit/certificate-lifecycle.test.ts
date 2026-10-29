import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateClientCertificateInventory } from '../../scripts/security/certificate-lifecycle.mjs';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const association = { success: true, result: { hostnames: ['www.atlasenterprisesuite.com'] } };
const afterDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
function certificate(overrides: Record<string, unknown> = {}) {
  return {
    id: '0123456789abcdef0123456789abcdef',
    status: 'active',
    expires_on: afterDays(60),
    fingerprint_sha256: 'a'.repeat(64),
    serial_number: 'abc123',
    ...overrides,
  };
}
function inventory(records: unknown[], options: Record<string, unknown> = {}) {
  return evaluateClientCertificateInventory({
    pages: [{
      success: true,
      result: records,
      result_info: { page: 1, per_page: 50, total_pages: 1, total_count: records.length },
    }],
    hostnameAssociations: association,
    ...options,
  }, { now: NOW });
}

describe('ATLAS certificate lifecycle Cloudflare read-only auditor', () => {
  it('does not claim production-ready when certificate PEM evidence is missing', () => {
    const outcome = inventory([certificate()]);
    expect(outcome.status).toBe('warning');
    expect(outcome.counts.unverified_pem).toBe(1);
    expect(outcome.reconciliation).toBe('provider_only_unverified_against_atlas_agent_bindings');
    expect(outcome.policy.auto_issue_without_device_csr).toBe(false);
  });
  it('flags renewal thresholds without generating a private key or activating a certificate', () => {
    const warning = inventory([certificate({ expires_on: afterDays(20) })]);
    expect(warning.status).toBe('warning');
    expect(warning.next_action).toBe('request_device_generated_csr');
    expect(warning.findings.some((f: any) => f.code === 'certificate_renewal_due')).toBe(true);
    const critical = inventory([certificate({ expires_on: afterDays(3) })]);
    expect(critical.status).toBe('blocked');
    expect(critical.counts.critical).toBe(1);
    const expired = inventory([certificate({ expires_on: afterDays(-1) })]);
    expect(expired.status).toBe('blocked');
    expect(expired.counts.expired).toBe(1);
  });
  it('blocks unknown status, malformed fingerprint, duplicate identities and malformed PEM', () => {
    expect(inventory([certificate({ status: 'mystery' })]).status).toBe('blocked');
    expect(inventory([certificate({ fingerprint_sha256: 'nope' })]).status).toBe('blocked');
    expect(inventory([certificate(), certificate()]).status).toBe('blocked');
    expect(inventory([certificate({ certificate: 'not a PEM certificate' })]).status).toBe('blocked');
  });
  it('treats revoked certificates as non-active and never as proof of mTLS availability', () => {
    const result = inventory([certificate({ status: 'revoked', expires_on: afterDays(-10) })]);
    expect(result.counts.active).toBe(0);
    expect(result.counts.revoked).toBe(1);
    expect(result.status).toBe('warning');
  });
  it('blocks missing mTLS hostname CA association', () => {
    const result = inventory([certificate()], { hostnameAssociations: { success: true, result: { hostnames: [] } } });
    expect(result.status).toBe('blocked');
    expect(result.findings.some((f: any) => f.code === 'mtls_hostname_association_missing')).toBe(true);
  });
  it('fails closed on incomplete, inconsistent or forged Cloudflare pagination', () => {
    const one = {
      success: true,
      result: [certificate()],
      result_info: { page: 1, per_page: 50, total_pages: 2, total_count: 2 },
    };
    expect(() => evaluateClientCertificateInventory({ pages: [one], hostnameAssociations: association }, { now: NOW })).toThrow('inventory_incomplete');
    expect(() => evaluateClientCertificateInventory({
      pages: [{ ...one, result_info: { ...one.result_info, total_pages: 1 } }],
      hostnameAssociations: association,
    }, { now: NOW })).toThrow('inventory_incomplete');
  });
  it('does not emit sensitive certificate identifiers or supplied credentials', () => {
    const item = certificate({ private_key: 'NEVER_LOG_ME', csr: 'CSR_CONTENT', token: 'SECRET_TOKEN' });
    const output = JSON.stringify(inventory([item]));
    expect(output).not.toContain('NEVER_LOG_ME');
    expect(output).not.toContain('CSR_CONTENT');
    expect(output).not.toContain('SECRET_TOKEN');
    expect(output).not.toContain(item.id as string);
    expect(output).not.toContain(item.fingerprint_sha256 as string);
  });
  it('uses the existing Cloudflare production secret and read-only calls only', () => {
    const workflow = readFileSync('.github/workflows/certificate-lifecycle-audit.yml', 'utf8');
    const scanner = readFileSync('scripts/security/scan-certificate-lifecycle.mjs','utf8');
    const providerWorkflow = readFileSync('.github/workflows/local-agent-mtls.yml', 'utf8');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN');
    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('scan-certificate-lifecycle.mjs');
    expect(scanner).toContain('status=all&per_page=50&page=');
    expect(scanner).toContain('/certificate_authorities/hostname_associations');
    expect(scanner).not.toContain("method: 'POST'");
    expect(scanner).not.toContain("method: 'DELETE'");
    expect(providerWorkflow).toContain('atlas-local-agent-mtls-provision');
  });
});
