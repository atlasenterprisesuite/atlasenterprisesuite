/**
 * ATLAS 777 digital-product prelaunch evidence gate.
 * Pure advisory evaluation only. Never invokes checkout, publication or payment.
 * Server-side authorization, provenance verification, RLS and approvals remain required.
 */
export type DigitalProductEvidenceKind = 'demand' | 'rights' | 'quality' | 'approval';
export type DigitalProductEvidence = {
  id: string;
  kind: DigitalProductEvidenceKind;
  sourceUrl: string;
  checkedAt: string;
  verified: boolean;
};
export type DigitalProductLaunchInput = {
  tenantId: string;
  productTenantId: string;
  productId: string;
  productVersion: string;
  evidence: readonly DigitalProductEvidence[];
  requestedAt: string;
};
export type DigitalProductLaunchAssessment = {
  decision: 'NO_GO' | 'REVIEW_REQUIRED';
  executable: false;
  blockers: string[];
  presentKinds: DigitalProductEvidenceKind[];
};
const REQUIRED: readonly DigitalProductEvidenceKind[] = ['demand', 'rights', 'quality', 'approval'];

function validTime(value: string): number | null {
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function evaluateDigitalProductLaunch(input: DigitalProductLaunchInput): DigitalProductLaunchAssessment {
  const blockers: string[] = [];
  if (!input || !input.tenantId?.trim() || !input.productTenantId?.trim() ||
      !input.productId?.trim() || !input.productVersion?.trim()) {
    blockers.push('MISSING_IDENTITY');
  }
  if (input?.tenantId && input?.productTenantId && input.tenantId !== input.productTenantId) {
    blockers.push('TENANT_MISMATCH');
  }
  const requestedAt = validTime(input?.requestedAt);
  if (requestedAt === null) blockers.push('INVALID_REQUEST_TIME');
  const evidence = Array.isArray(input?.evidence) ? input.evidence : [];
  const presentKinds: DigitalProductEvidenceKind[] = [];
  for (const kind of REQUIRED) {
    const eligible = evidence.some(item => {
      if (!item || item.kind !== kind || item.verified !== true ||
          !item.id?.trim() || !/^https:\/\//.test(item.sourceUrl || '')) return false;
      const checkedAt = validTime(item.checkedAt);
      return checkedAt !== null && requestedAt !== null && checkedAt <= requestedAt;
    });
    if (eligible) presentKinds.push(kind);
    else blockers.push(`MISSING_VERIFIED_${kind.toUpperCase()}`);
  }
  return {
    decision: blockers.length ? 'NO_GO' : 'REVIEW_REQUIRED',
    executable: false,
    blockers,
    presentKinds
  };
}
