import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareKnowledgeAtlasDrafts } from './knowledge-atlas-drafts.mjs';

const sha = 'a'.repeat(64);
const entries = [
  { title: 'Idea 1', content: 'Texto autorizado de ejemplo', source: 'Ejemplo 1', timestamp: '2026-11-23T00:00:00Z' },
  { title: 'No seleccionar', content: 'Esta nota nunca debe filtrarse', source: 'Ejemplo 2', timestamp: '2026-11-23T00:00:00Z' }
];
const args = { entries, capsuleSha256: sha, selectedIndices: [0], reviewed: true };

test('only explicitly reviewed and selected entries become restricted draft records', () => {
  const batch = prepareKnowledgeAtlasDrafts(args);
  assert.equal(batch.approve, false);
  assert.equal(batch.records.length, 1);
  assert.equal(batch.records[0].title, 'Idea 1');
  assert.equal(batch.records[0].source_type, 'document');
  assert.equal(batch.records[0].sensitivity, 'restricted');
  assert.equal(batch.records[0].source_ref, 'chronoseed:' + sha + ':entry:0');
  assert.ok(!('source_hash' in batch.records[0])); // No stable plaintext fingerprints.
  assert.ok(!JSON.stringify(batch).includes('Esta nota nunca debe filtrarse'));
  assert.ok(!('status' in batch.records[0]) && !('approved_by' in batch.records[0]));
});

test('fails closed unless reviewed and selected, no blanket imports', () => {
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, reviewed: false }), /review_required/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, selectedIndices: [] }), /selection_required/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, selectedIndices: [0, 0] }), /invalid_selection/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, selectedIndices: [99] }), /invalid_selection/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, selectedIndices: ['0'] }), /invalid_selection/);
});

test('rejects invalid fingerprints, modules, source classification and invalid selected notes', () => {
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, capsuleSha256: 'unknown' }), /invalid_fingerprint/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, moduleIds: ['../../secret'] }), /invalid_modules/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, sourceType: 'system_event' }), /invalid_source_type/);
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, entries: [{ ...entries[0], content: '' }] }), /invalid_selected_entry/);
});

test('caps batch at 50, isolates payloads and preserves original source', () => {
  const full = Array.from({ length: 51 }, (_, i) => ({ ...entries[0], title: 'Idea ' + i }));
  assert.throws(() => prepareKnowledgeAtlasDrafts({ ...args, entries: full, selectedIndices: full.map((_, i) => i) }), /selection_required/);
  const batch = prepareKnowledgeAtlasDrafts({ ...args, entries: full, selectedIndices: [2, 5], moduleIds: ['knowledge', 'knowledge'], sourceType: 'user_entry' });
  assert.deepEqual(batch.records.map(x => x.title), ['Idea 2', 'Idea 5']);
  assert.deepEqual(batch.records[0].module_ids, ['knowledge']);
  assert.equal(batch.records[0].content_json.original_source, 'Ejemplo 1');
  assert.equal(batch.records[0].source_type, 'user_entry');
});
