import { describe, expect, it } from 'vitest';
import { certifyIntegration, readinessNotification } from '../../packages/core/src/integrationReadiness777';
const sha = 'a'.repeat(40);
const names = ['unit', 'integration', 'typecheck', 'build', 'security', 'tenantIsolation'];
const checks = Object.fromEntries(names.map((name, i) => [name, { sha, status: 'completed', conclusion: 'success', runId: i + 1 }]));
const input = { moduleId: 'atlas-pay', sha, checks, p0Open: false, authorizationRequired: true, authorized: true };
describe('ATLAS Integration Readiness & Certification 777', () => {
  it('rejects absent evidence and malformed identity', () => {
    expect(certifyIntegration({ moduleId: 'atlas-pay', sha }).certified).toBe(false);
    expect(certifyIntegration({ moduleId: 'atlas-pay', sha: 'main' }).blockers).toContain('INVALID_IDENTITY');
  });
  it('rejects successful checks from a different SHA', () => {
    const result = certifyIntegration({ ...input, checks: { ...checks, security: { ...checks.security, sha: 'b'.repeat(40) } } });
    expect(result.blockers).toContain('UNVERIFIED_SECURITY');
    expect(result.certified).toBe(false);
  });
  it('rejects open P0 and pending authorization', () => {
    expect(certifyIntegration({ ...input, p0Open: true }).blockers).toContain('P0_OPEN');
    expect(certifyIntegration({ ...input, authorized: false }).blockers).toContain('AUTHORIZATION_REQUIRED');
  });
  it('requires verified post-deployment evidence for operational certification', () => {
    expect(certifyIntegration(input).state).toBe('ready_for_approval');
    expect(certifyIntegration(input).certified).toBe(false);
    const result = certifyIntegration({ ...input, deployment: { environment: 'production', sha, status: 'success', postDeployVerified: true, evidenceId: 'run-1' } });
    expect(result.state).toBe('operational_confirmed');
    expect(result.certified).toBe(true);
  });
  it('does not trust deployment evidence for another SHA', () => {
    const result = certifyIntegration({ ...input, deployment: { environment: 'production', sha: 'b'.repeat(40), status: 'success', postDeployVerified: true, evidenceId: 'run-1' } });
    expect(result.certified).toBe(false);
  });
  it('notifies only milestone transitions or new human blockers', () => {
    const previous = certifyIntegration({ ...input, p0Open: true });
    const current = certifyIntegration(input);
    expect(readinessNotification(previous, current)?.state).toBe('ready_for_approval');
    expect(readinessNotification(current, current)).toBeNull();
    expect(readinessNotification(current, certifyIntegration({ ...input, authorized: false }))?.blockers).toContain('AUTHORIZATION_REQUIRED');
  });
});
