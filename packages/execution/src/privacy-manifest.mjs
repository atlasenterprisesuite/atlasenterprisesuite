// Declaration validation only. Never an authorization or runtime privacy proof.
const categories = new Set(['contact','financial','health','location','media','communications','activity','contacts','identifiers','purchases','diagnostics','usage','sensitive','environment','other']);
const purposes = new Set(['account','functionality','security','support','analytics']);
const recipients = new Set(['local','atlas']);
function exactKeys(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value,key);
    return descriptor && descriptor.enumerable && Object.hasOwn(descriptor,'value');
  });
}
function plainCollection(value, max) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let i=0;i<value.length;i++) {
    const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor,'value')) return false;
  }
  return true;
}
const flowKey = row => JSON.stringify([row.category,row.purpose,row.linked,row.recipient]);
const blocked = reason => ({status:'blocked',reason,labels:[],verified:false});
export function evaluatePrivacyManifest(value) {
  try { return evaluateDeclaration(value); } catch { return blocked('invalid_manifest'); }
}
function evaluateDeclaration(value) {
  if (!exactKeys(value,['schema','module','collection']) || value.schema !== 'atlas.privacy.v1' ||
      typeof value.module !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value.module) ||
      !plainCollection(value.collection,256)) return blocked('invalid_manifest');
  const labels = new Set();
  const declaredFlows = new Set();
  for (let i=0;i<value.collection.length;i++) {
    const row=value.collection[i];
    if (!exactKeys(row,['category','purpose','linked','recipient','retentionDays']) ||
        !categories.has(row.category) || !purposes.has(row.purpose) || !recipients.has(row.recipient) ||
        typeof row.linked !== 'boolean' || !Number.isSafeInteger(row.retentionDays) || row.retentionDays < 1 ||
        row.retentionDays > 3650) return blocked('invalid_collection');
    const key = flowKey(row);
    if (declaredFlows.has(key)) return blocked('duplicate_or_ambiguous_flow');
    declaredFlows.add(key);
    labels.add(row.linked ? 'linked' : 'unlinked_declared');
  }
  return {status:'declared',labels:labels.size ? [...labels].sort() : ['none_declared'],verified:false};
}

// Metadata reconciliation only: never reads personal records or grants permission.
// Callers must obtain authenticated, tenant-scoped evidence separately.
export function reconcilePrivacyInventory(serialized) {
  const deny = reason => ({status:'blocked',reason,verified:false,authorization:'not_evaluated'});
  if (typeof serialized !== 'string' || serialized.length > 1000000) return deny('invalid_envelope');
  let input;
  try { input = JSON.parse(serialized); } catch { return deny('invalid_envelope'); }
  if (!exactKeys(input,['manifests','observations']) ||
      !Array.isArray(input.manifests) || !input.manifests.length || input.manifests.length > 256 ||
      !Array.isArray(input.observations) || input.observations.length > 4096) return deny('invalid_envelope');
  const registry = new Map();
  for (const manifest of input.manifests) {
    if (evaluatePrivacyManifest(manifest).status !== 'declared') return deny('invalid_manifest');
    if (registry.has(manifest.module)) return deny('duplicate_module');
    registry.set(manifest.module,manifest.collection);
  }
  const seen = new Set();
  const covered = new Set();
  const seenObservations = new Set();
  for (const row of input.observations) {
    if (!exactKeys(row,['module','category','purpose','linked','recipient','retentionDays'])) return deny('invalid_observation');
    const {module,...collection} = row;
    if (evaluatePrivacyManifest({schema:'atlas.privacy.v1',module,collection:[collection]}).status !== 'declared') return deny('invalid_observation');
    const observationKey = JSON.stringify([module,flowKey(row),row.retentionDays]);
    if (seenObservations.has(observationKey)) return deny('duplicate_observation');
    seenObservations.add(observationKey);
    const entries = registry.get(module);
    if (!entries) return deny('undeclared_observation');
    const matches = entries.filter(entry => entry.category === row.category && entry.purpose === row.purpose &&
      entry.linked === row.linked && entry.recipient === row.recipient && entry.retentionDays >= row.retentionDays);
    if (!matches.length) return deny('undeclared_observation');
    seen.add(module);
    for (const match of matches) covered.add(match);
  }
  const unobservedModules = registry.size - seen.size;
  const complete = unobservedModules === 0 && [...registry.values()].every(entries=>entries.every(entry=>covered.has(entry)));
  return {status:complete?'matched_metadata':'incomplete_metadata',modules:registry.size,
    observations:input.observations.length,matched:input.observations.length,unobservedModules,
    verified:false,authorization:'not_evaluated'};
}
