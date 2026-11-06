/** Encrypted offline continuity journal. No network, automatic enrollment, or authorization claims.
 * receive() accepts only operations already authenticated/authorized by a future transport adapter.
 * A digest detects corruption; it is not a signature or permission check.
 */
import { createHash, randomUUID } from 'node:crypto';
import { memoryGet, memoryUpdate } from './local-core-vault.mjs';
const KEY = 'continuity-v1';
const safe = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const hash = op => createHash('sha256').update(JSON.stringify([op.v, op.tenant, op.id, op.record, op.parent, op.value])).digest('hex');
function validate(op, tenant) {
  if (!op || op.v !== 1 || !safe(op.id) || !safe(op.record) || !safe(op.tenant) ||
      !(op.parent === null || safe(op.parent)) || typeof op.value !== 'string' || Buffer.byteLength(op.value) > 8192)
    throw new Error('continuity_invalid_operation');
  if (op.tenant !== tenant) throw new Error('continuity_tenant_mismatch');
  if (op.digest !== hash(op)) throw new Error('continuity_digest_mismatch');
  return { v: 1, tenant: op.tenant, id: op.id, record: op.record, parent: op.parent, value: op.value, digest: op.digest };
}
export function createContinuity({ directory, passphrase, tenant } = {}) {
  if (!safe(tenant)) throw new Error('continuity_invalid_tenant');
  const options = { directory, passphrase, id: KEY };
  const decode = raw => {
    const state = raw === null ? { v: 1, tenant, records: {}, events: [], pending: [], conflicts: [] } : JSON.parse(raw);
    if (state.v !== 1 || state.tenant !== tenant) throw new Error('continuity_tenant_mismatch');
    return state;
  };
  const load = async () => decode(await memoryGet(options));
  const transaction = async fn => {
    let result;
    await memoryUpdate({ ...options, update: raw => {
      const state = decode(raw); result = fn(state); return JSON.stringify(state);
    } });
    return result;
  };
  return {
    async edit(record, value) {
      return transaction(state => {
        const op = { v: 1, tenant, id: randomUUID(), record, parent: Object.hasOwn(state.records, record) ? state.records[record].id : null, value };
        op.digest = hash(op); validate(op, tenant);
        state.records[record] = op; state.events.push(op); state.pending.push(op.id);
        return op.id;
      });
    },
    async read(record) {
      if (!safe(record)) throw new Error('continuity_invalid_record');
      const state = await load(); return Object.hasOwn(state.records, record) ? state.records[record].value : null;
    },
    async status() {
      const state = await load(); return { pending: state.pending.length, conflicts: state.conflicts.length, versions: state.events.length };
    },
    async receive(input) {
      const op = validate(input, tenant);
      return transaction(state => {
        const existing = state.events.find(e => e.id === op.id);
        if (existing) {
          if (existing.digest !== op.digest) throw new Error('continuity_id_reused');
          return 'duplicate';
        }
        const current = Object.hasOwn(state.records, op.record) ? state.records[op.record].id : null;
        state.events.push(op);
        if (current !== op.parent) { state.conflicts.push(op.id); return 'conflict'; }
        state.records[op.record] = op; return 'applied';
      });
    },
    async flush(send) {
      if (typeof send !== 'function') throw new Error('continuity_transport_required');
      // Fixed snapshot: edits made during delivery remain queued for the next flush.
      const state = await load();
      if (state.conflicts.length) throw new Error('continuity_unresolved_conflict');
      for (const id of state.pending) {
        const op = state.events.find(e => e.id === id);
        const ack = await send(structuredClone(op));
        if (!ack || ack.id !== id || ack.digest !== op.digest || ack.tenant !== tenant) throw new Error('continuity_ack_mismatch');
        await transaction(current => { current.pending = current.pending.filter(x => x !== id); });
      }
    }
  };
}
