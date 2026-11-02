import type { ReadinessResult } from './integrationReadiness777';

/** Server-only boundary. The caller must authenticate the tenant and inject a privileged RPC. */
export type CertificationRpc777 = (args: {
  p_org_id: string; p_tenant_id: string; p_module_id: string;
  p_sha: string; p_evidence: ReadinessResult;
}) => Promise<{ data: boolean | null; error: { message?: string } | null }>;

/** Does not use the legacy load/append/save contract, which cannot guarantee atomicity. */
export function atomicCertificationStore777(scope: {
  organizationId: string; tenantId: string;
}, rpc: CertificationRpc777) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(scope.organizationId) || !scope.tenantId || scope.tenantId !== scope.tenantId.trim())
    throw new Error('INVALID_CERTIFICATION_SCOPE');
  return {
    async record(current: ReadinessResult): Promise<void> {
      if (!current.moduleId || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(current.moduleId) ||
        !current.sha || !/^[a-f0-9]{40}$/.test(current.sha) ||
        current.certified !== false || !Array.isArray(current.blockers) ||
        !Array.isArray(current.verifiedChecks))
        throw new Error('INVALID_CERTIFICATION_EVIDENCE');
      const response = await rpc({
        p_org_id: scope.organizationId,
        p_tenant_id: scope.tenantId,
        p_module_id: current.moduleId,
        p_sha: current.sha,
        p_evidence: current
      });
      if (response?.error || response?.data !== true)
        throw new Error('CERTIFICATION_WRITE_UNCONFIRMED');
    }
  };
}
