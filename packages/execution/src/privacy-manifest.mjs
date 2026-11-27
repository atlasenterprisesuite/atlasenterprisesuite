// Declaration validation only. Never an authorization or runtime privacy proof.
const categories = new Set(['contact','financial','health','location','media','communications','activity','contacts','identifiers','purchases','diagnostics','usage','sensitive','environment','other']);
const purposes = new Set(['account','functionality','security','support','analytics']);
const recipients = new Set(['local','atlas']);
function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value,key));
}
const blocked = reason => ({status:'blocked',reason,labels:[],verified:false});
export function evaluatePrivacyManifest(value) {
  if (!exactKeys(value,['schema','module','collection']) || value.schema !== 'atlas.privacy.v1' ||
      typeof value.module !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value.module) ||
      !Array.isArray(value.collection) || value.collection.length > 256) return blocked('invalid_manifest');
  const labels = new Set();
  for (const row of value.collection) {
    if (!exactKeys(row,['category','purpose','linked','recipient','retentionDays']) ||
        !categories.has(row.category) || !purposes.has(row.purpose) || !recipients.has(row.recipient) ||
        typeof row.linked !== 'boolean' || !Number.isSafeInteger(row.retentionDays) || row.retentionDays < 1 ||
        row.retentionDays > 3650) return blocked('invalid_collection');
    labels.add(row.linked ? 'linked' : 'unlinked_declared');
  }
  return {status:'declared',labels:labels.size ? [...labels].sort() : ['none_declared'],verified:false};
}
