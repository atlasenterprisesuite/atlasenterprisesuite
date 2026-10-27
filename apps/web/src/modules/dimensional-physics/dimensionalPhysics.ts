export type ClaimKind = 'mathematical' | 'hypothesis' | 'simulation' | 'observation';
export type ClaimStatus = 'model-derived' | 'experimentally-observed';
const HBAR_C_GEV_M = 1.973269804e-16;
/** S1 KK excitation energy in GeV for zero four-dimensional rest mass. */
export function kkMassGeV(radiusMeters: number, mode: number): number {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || !Number.isSafeInteger(mode) || mode < 0) throw new Error('INVALID_KK_PARAMETERS');
  return mode * HBAR_C_GEV_M / radiusMeters;
}
/** ADD toy scaling: M_Pl^(2+n) ~ M_D^(2+n) R^n; returns M_Pl in GeV. Convention-dependent; not a fitted observation. */
export function addPlanckScale(fundamentalGeV: number, extraDimensions: number, radiusGeVInverse: number): number {
  if (![fundamentalGeV,radiusGeVInverse].every(x=>Number.isFinite(x)&&x>0) || !Number.isSafeInteger(extraDimensions) || extraDimensions<1) throw new Error('INVALID_ADD_PARAMETERS');
  const result = fundamentalGeV * Math.pow(fundamentalGeV * radiusGeVInverse, extraDimensions / 2);
  if (!Number.isFinite(result)) throw new Error('ADD_OVERFLOW');
  return result;
}
/** RS toy warped energy scale in GeV, M_IR = M_UV exp(-k*pi*r). Dimensionless warp exponent. */
export function rsWarpedScaleGeV(uvScaleGeV: number, warpExponent: number): number {
  if (!Number.isFinite(uvScaleGeV) || uvScaleGeV<=0 || !Number.isFinite(warpExponent) || warpExponent<0) throw new Error('INVALID_RS_PARAMETERS');
  return uvScaleGeV*Math.exp(-warpExponent);
}
export function classifyDimension(kind: 'extra-spatial'|'hilbert'|'gps-context'): 'hypothetical-physical'|'mathematical-state-space'|'informational' {
  if (kind==='extra-spatial') return 'hypothetical-physical';
  if (kind==='hilbert') return 'mathematical-state-space';
  if (kind==='gps-context') return 'informational';
  throw new Error('UNKNOWN_DIMENSION_KIND');
}
export function classifyDimensionalClaim(input: {kind: ClaimKind; claim: ClaimStatus}): typeof input {
  if (input.claim==='experimentally-observed' && input.kind!=='observation') throw new Error('UNSUPPORTED_OBSERVATION_CLAIM');
  return input;
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function validateEvidenceRecord(record: {id:string;sourceUrl:string;publishedAt:string;kind:ClaimKind;model:string}): void {
  if (!record.id.trim() || !record.model.trim() || !record.sourceUrl.startsWith('https://') || !validDate(record.publishedAt)) throw new Error('INVALID_EVIDENCE');
}
export function validateResearchRun(input: {tenantId:string;actorTenantId:string;sourceUrl:string;sourceDate:string;paidCompute:boolean;costApproved:boolean}): void {
  if (!input.tenantId || input.tenantId!==input.actorTenantId) throw new Error('TENANT_DENIED');
  if (!input.sourceUrl.startsWith('https://') || !validDate(input.sourceDate)) throw new Error('MISSING_PROVENANCE');
  if (input.paidCompute && !input.costApproved) throw new Error('COMPUTE_COST_DENIED');
}
