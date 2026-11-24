/** Offline opt-in ChronoSeed -> Knowledge Atlas staging. No persistence or network. */
const MAX_BATCH = 50; // Atlas Memory api=import cap
const HEX_SHA256 = /^[a-f0-9]{64}$/;

/**
 * Prepare draft-only record suggestions. Caller must separately authenticate,
 * review the exact resulting records, and obtain authorization for any upload.
 * Deliberately no fetch, auto-approve, database write or defaults to all notes.
 */
export function prepareKnowledgeAtlasDrafts({ entries, capsuleSha256, selectedIndices, reviewed, moduleIds = [], sourceType = 'document' } = {}) {
  if (reviewed !== true) throw Error('chronoseed_explicit_review_required');
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 200) throw Error('chronoseed_invalid_entries');
  if (typeof capsuleSha256 !== 'string' || !HEX_SHA256.test(capsuleSha256)) throw Error('chronoseed_invalid_fingerprint');
  if (!Array.isArray(selectedIndices) || !selectedIndices.length || selectedIndices.length > MAX_BATCH) throw Error('chronoseed_selection_required');
  if (selectedIndices.some(i => !Number.isSafeInteger(i) || i < 0 || i >= entries.length) ||
      new Set(selectedIndices).size !== selectedIndices.length) throw Error('chronoseed_invalid_selection');
  if (!['document', 'user_entry', 'chat_import'].includes(sourceType)) throw Error('chronoseed_invalid_source_type');
  if (!Array.isArray(moduleIds) || moduleIds.length > 20 || moduleIds.some(x => typeof x !== 'string' || x.length > 100 || !/^[A-Za-z0-9_.:-]+$/.test(x))) throw Error('chronoseed_invalid_modules');
  const records = selectedIndices.map(index => {
    const e = entries[index];
    if (!e || typeof e.title !== 'string' || !e.title.trim() || e.title.length > 160 ||
        typeof e.content !== 'string' || !e.content.trim() || e.content.length > 100000 ||
        typeof e.source !== 'string' || e.source.length > 500 ||
        typeof e.timestamp !== 'string' || !e.timestamp || e.timestamp.length > 40) throw Error('chronoseed_invalid_selected_entry');
    return {
      kind: 'note',
      title: e.title.trim(),
      summary: 'Nota importada desde cápsula ChronoSeed; pendiente de verificación de hechos y aprobación.',
      content_json: { text: e.content, original_source: e.source, original_timestamp: e.timestamp, capsule_sha256: capsuleSha256, capsule_entry_index: index },
      source_type: sourceType,
      source_ref: 'chronoseed:' + capsuleSha256 + ':entry:' + index,
      sensitivity: 'restricted',
      tags: ['chronoseed', 'review_required'],
      module_ids: [...new Set(moduleIds)]
    };
  });
  return { approve: false, records };
}
