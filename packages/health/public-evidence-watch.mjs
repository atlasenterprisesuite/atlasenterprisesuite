/**
 * Public Health Evidence Watch — pure, deterministic public-data boundary.
 * Research surveillance only. No clinical decisions or automatic outbreak declarations.
 * No network or database access; server-side ingestion must authenticate, audit and
 * enforce organization-scoped RBAC/RLS before persisting any output.
 */
export const EVIDENCE_STATUS = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  CORROBORATED: 'CORROBORATED',
  CONTRADICTED: 'CONTRADICTED',
  INSUFFICIENT: 'INSUFFICIENT'
});
const ALLOWED = new Set(['cdc.gov', 'data.cdc.gov', 'who.int', 'www.who.int']);
function validSourceUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password &&
      !u.port && ALLOWED.has(u.hostname.toLowerCase()) &&
      !u.hash && u.pathname.length < 1024;
  } catch { return false; }
}
function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString().startsWith(s);
}
function nonEmpty(s, max=256) {
  return typeof s === 'string' && s.trim().length > 0 && s.length <= max;
}
export function normalizePublicSignal(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_signal');
  if (!nonEmpty(input.sourceId) || !nonEmpty(input.claimKey) ||
      !nonEmpty(input.region) || !nonEmpty(input.sourceFamily) ||
      !validSourceUrl(input.url) || !validDate(input.publishedOn) ||
      !validDate(input.observedOn) || !['SUPPORTS','DISPUTES','UNKNOWN'].includes(input.stance))
    throw new Error('invalid_signal');
  if (input.observedOn > input.publishedOn) throw new Error('invalid_signal_dates');
  return Object.freeze({
    sourceId: input.sourceId.trim(), claimKey: input.claimKey.trim(),
    region: input.region.trim(), sourceFamily: input.sourceFamily.trim(),
    url: input.url, publishedOn: input.publishedOn, observedOn: input.observedOn,
    stance: input.stance, evidenceType: 'PUBLIC_SURVEILLANCE',
    clinicalActionAllowed: false
  });
}
export function evaluatePublicClaim(signals, {asOf, maxAgeDays=30}={}) {
  if (!validDate(asOf) || !Number.isInteger(maxAgeDays) || maxAgeDays<1 || maxAgeDays>365)
    throw new Error('invalid_evaluation_window');
  if (!Array.isArray(signals)) throw new Error('invalid_signals');
  const unique = new Map();
  for (const raw of signals) {
    const s=normalizePublicSignal(raw);
    if (s.publishedOn > asOf) continue;
    const age=(Date.parse(asOf)-Date.parse(s.publishedOn))/86400000;
    if (age>maxAgeDays) continue;
    const key=s.sourceFamily+'::'+s.sourceId;
    const prior=unique.get(key);
    if (prior && JSON.stringify(prior)!==JSON.stringify(s))
      throw new Error('conflicting_source_identity');
    unique.set(key,s);
  }
  const current=[...unique.values()];
  const claims=new Set(current.map(s=>s.claimKey+'::'+s.region));
  if (claims.size>1) throw new Error('mixed_claim_scope');
  const supports=new Set(current.filter(s=>s.stance==='SUPPORTS').map(s=>s.sourceFamily));
  const disputes=new Set(current.filter(s=>s.stance==='DISPUTES').map(s=>s.sourceFamily));
  const status=supports.size && disputes.size ? EVIDENCE_STATUS.CONTRADICTED :
    supports.size>=2 ? EVIDENCE_STATUS.CORROBORATED : EVIDENCE_STATUS.INSUFFICIENT;
  return Object.freeze({
    status, independentSupportingFamilies:supports.size,
    disputingFamilies:disputes.size, acceptedRecords:current.length,
    asOf, maxAgeDays, outbreakConfirmed:false, clinicalActionAllowed:false,
    limitations:['Source-family distinctness is not proof of independence.',
      'Signals do not independently establish a public-health emergency.',
      'Source freshness and geographic coverage require external verification.']
  });
}
