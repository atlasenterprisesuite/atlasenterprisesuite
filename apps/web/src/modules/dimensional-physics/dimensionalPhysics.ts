export type ClaimKind = 'mathematical' | 'hypothesis' | 'simulation' | 'observation';
export type ClaimStatus = 'model-derived' | 'experimentally-observed';
const HBAR_C_GEV_M = 1.973269804e-16;
/** Compact S1 Kaluza-Klein excitation, m_n = n hbar c / R, in GeV. Assumes zero 4D rest mass. */
export function kkMassGeV(radiusMeters: number, mode: number): number {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || !Number.isSafeInteger(mode) || mode < 0) throw new Error('INVALID_KK_PARAMETERS');
  return mode * HBAR_C_GEV_M / radiusMeters;
}
export function classifyDimensionalClaim(input: { kind: ClaimKind; claim: ClaimStatus }): typeof input {
  if (input.claim === 'experimentally-observed' && input.kind !== 'observation') throw new Error('UNSUPPORTED_OBSERVATION_CLAIM');
  return input;
}
export function validateResearchRun(input: {
  tenantId: string; actorTenantId: string; sourceUrl: string; sourceDate: string;
  paidCompute: boolean; costApproved: boolean;
}): void {
  if (!input.tenantId || input.tenantId !== input.actorTenantId) throw new Error('TENANT_DENIED');
  if (!input.sourceUrl.startsWith('https://') || !/^\\d{4}-\\d{2}-\\d{2}$/.test(input.sourceDate)) throw new Error('MISSING_PROVENANCE');
  if (input.paidCompute && !input.costApproved) throw new Error('COMPUTE_COST_DENIED');
}
