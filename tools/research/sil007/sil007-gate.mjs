// SIL-007 research gate. No claim of technological origin is inferred by this function.
// Evidence levels are authorization ceilings, NOT probabilities or automated discovery.
export function assessSil007(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {level:'E0', permitted:false, reasons:['invalid_record']};
  const reasons=[];
  const hash=typeof record.rawSha256==='string' && /^[a-f0-9]{64}$/i.test(record.rawSha256);
  const provenance=Boolean(record.sampleId && record.sectionId && record.horizonId && record.sourceUri && hash);
  const chronology=Boolean(record.ageModel && Number.isFinite(record.ageUncertainty) && record.ageUncertainty>=0);
  const qc=record.qcPassed===true && record.contaminationDetected===false;
  const replicated=record.independentReplication===true;
  const positive=record.independentPositiveTechnologicalIndicators===true && record.alternativesTested===true;
  const reviewed=record.independentExpertReview===true && record.peerScrutiny===true;
  if(!provenance) reasons.push('missing_provenance_or_sha256');
  if(!chronology) reasons.push('unverified_chronology');
  if(!qc) reasons.push('qc_or_contamination_block');
  if(record.synthetic===true) reasons.push('synthetic_fixture');
  if(!replicated) reasons.push('no_independent_replication');
  if(!positive) reasons.push('no_positive_technological_evidence');
  if(!reviewed) reasons.push('no_independent_review');
  if(record.synthetic===true) return {level:'E0',permitted:false,reasons};
  if(!provenance || !chronology || !qc) return {level:'E1',permitted:false,reasons};
  if(!replicated) return {level:'E1',permitted:false,reasons};
  if(!positive) return {level: record.alternativesTested===true ? 'E3':'E2',permitted:false,reasons};
  if(!reviewed) return {level:'E4',permitted:false,reasons};
  return {level:'E5',permitted:true,reasons:[]};
}
