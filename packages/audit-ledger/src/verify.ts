import { buildAuditLedgerDigest } from './digest';
import type { AuditChainVerification, AuditLedgerEvent } from './types';

export async function verifyAuditChain(
  events: AuditLedgerEvent[],
  options: { allowEmpty?: boolean } = {}
): Promise<AuditChainVerification> {
  if (events.length === 0) {
    return options.allowEmpty
      ? { valid: true, eventCount: 0 }
      : { valid: false, eventCount: 0, reason: 'audit_ledger_no_events' };
  }

  const ordered = [...events].sort((a, b) => {
    const time = a.createdAt.localeCompare(b.createdAt);
    return time !== 0 ? time : a.eventId.localeCompare(b.eventId);
  });

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const expectedPreviousHash = index === 0 ? 'GENESIS_BLOCK' : ordered[index - 1].payloadDigest;
    if (current.previousStateHash !== expectedPreviousHash) {
      return {
        valid: false,
        eventCount: ordered.length,
        firstInvalidEventId: current.eventId,
        reason: 'audit_ledger_integrity_failed'
      };
    }

    const digest = await buildAuditLedgerDigest(current);
    if (digest !== current.payloadDigest) {
      return {
        valid: false,
        eventCount: ordered.length,
        firstInvalidEventId: current.eventId,
        reason: 'audit_ledger_invalid_digest'
      };
    }
  }

  return { valid: true, eventCount: ordered.length };
}
