import type { ExperimentalLimit } from './experimentalLimits';
export type ClaimKind='mathematical'|'hypothesis'|'simulation'|'observation';
export type ClaimStatus='model-derived'|'experimentally-observed';
const HBAR_C_GEV_M=1.973269804e-16;
/** Zero-rest-mass S1 Kaluza-Klein mode energy in GeV. */
export function kkMassGeV(radiusMeters:number,mode:number):number {
 if(!Number.isFinite(radiusMeters)||radiusMeters<=0||!Number.isSafeInteger(mode)||mode<0)throw Error('INVALID_KK_PARAMETERS');
 const value=mode*HBAR_C_GEV_M/radiusMeters;
 if(!Number.isFinite(value))throw Error('KK_OVERFLOW');
 return value;
}
export function propagateKkUncertainty(radiusMeters:number,mode:number,radiusUncertaintyMeters:number){
 if(!Number.isFinite(radiusUncertaintyMeters)||radiusUncertaintyMeters<0||radiusUncertaintyMeters>=radiusMeters)throw Error('INVALID_RADIUS_UNCERTAINTY');
 const valueGeV=kkMassGeV(radiusMeters,mode);
 return {valueGeV,uncertaintyGeV:valueGeV*radiusUncertaintyMeters/radiusMeters,method:'first-order derivative, independent radius uncertainty' as const};
}
/** Toy ADD scaling, convention M_Pl² = M_D^(n+2) R^n; omits geometric 2π factors. Inputs GeV and GeV^-1. */
export function addPlanckScale(fundamentalGeV:number,extraDimensions:number,radiusGeVInverse:number):number{
 if(!Number.isFinite(fundamentalGeV)||fundamentalGeV<=0||!Number.isFinite(radiusGeVInverse)||radiusGeVInverse<=0||!Number.isSafeInteger(extraDimensions)||extraDimensions<1)throw Error('INVALID_ADD_PARAMETERS');
 const logResult=Math.log(fundamentalGeV)+(extraDimensions/2)*Math.log(fundamentalGeV*radiusGeVInverse);
 if(logResult>Math.log(Number.MAX_VALUE)||logResult<Math.log(Number.MIN_VALUE))throw Error('ADD_NUMERICAL_RANGE');
 return Math.exp(logResult);
}
/** RS toy warp energy M_IR = M_UV exp(-kπr), exponent dimensionless. */
export function rsWarpedScaleGeV(uvScaleGeV:number,warpExponent:number):number{
 if(!Number.isFinite(uvScaleGeV)||uvScaleGeV<=0||!Number.isFinite(warpExponent)||warpExponent<0)throw Error('INVALID_RS_PARAMETERS');
 const logResult=Math.log(uvScaleGeV)-warpExponent;
 if(logResult<Math.log(Number.MIN_VALUE))throw Error('RS_UNDERFLOW');
 return Math.exp(logResult);
}
export function classifyDimension(kind:'extra-spatial'|'hilbert'|'gps-context'){
 if(kind==='extra-spatial')return 'hypothetical-physical';
 if(kind==='hilbert')return 'mathematical-state-space';
 if(kind==='gps-context')return 'informational';
 throw Error('UNKNOWN_DIMENSION_KIND');
}
export function classifyDimensionalClaim(input:{kind:ClaimKind;claim:ClaimStatus}){
 if(input.claim==='experimentally-observed'&&input.kind!=='observation')throw Error('UNSUPPORTED_OBSERVATION_CLAIM');
 return input;
}
function validDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function validateEvidenceRecord(record:{id:string;sourceUrl:string;publishedAt:string;kind:ClaimKind;model:string}):void{
 if(!record.id.trim()||!record.model.trim()||!record.sourceUrl.startsWith('https://')||!validDate(record.publishedAt))throw Error('INVALID_EVIDENCE');
}
export function validateResearchRun(input:{tenantId:string;actorTenantId:string;sourceUrl:string;sourceDate:string;paidCompute:boolean;costApproved:boolean}):void{
 if(!input.tenantId||input.tenantId!==input.actorTenantId)throw Error('TENANT_DENIED');
 if(!input.sourceUrl.startsWith('https://')||!validDate(input.sourceDate))throw Error('MISSING_PROVENANCE');
 if(input.paidCompute&&!input.costApproved)throw Error('COMPUTE_COST_DENIED');
}
export function validateExperimentalLimit(record:ExperimentalLimit):void{
 if(!record.id.trim()||!record.benchmark.trim()||!record.dataset.trim()||!record.sourceVersion.trim()||!record.uncertaintyNote.trim()||!Number.isFinite(record.boundTeV)||record.boundTeV<=0||record.confidenceLevel!==0.95)throw Error('INVALID_LIMIT');
 validateEvidenceRecord({id:record.id,sourceUrl:record.sourceUrl,publishedAt:record.publishedAt,kind:'observation',model:record.model});
}
export function comparableLimits(a:ExperimentalLimit,b:ExperimentalLimit):boolean{
 return a.model===b.model&&a.observable===b.observable&&a.benchmark===b.benchmark&&a.boundKind===b.boundKind&&a.confidenceLevel===b.confidenceLevel;
}
