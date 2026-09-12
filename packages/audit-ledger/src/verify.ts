import { buildAuditLedgerDigest } from './digest';
import type { AuditChainVerification, AuditLedgerEvent } from './types';

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function verifyAuditChain(
  events: AuditLedgerEvent[],
  options: { allowEmpty?: boolean } = {}
): Promise<AuditChainVerification> {
  if (events.length === 0) {
    return options.allowEmpty
      ? { valid: true, eventCount: 0 }
      : { valid: false, eventCount: 0, reason: 'audit_ledger_no_events' };
  }

  const timestamped = events.map((event) => ({ event, time: Date.parse(event.createdAt) }));
  const invalidTimestamp = timestamped.find((item) => !Number.isFinite(item.time));
  if (invalidTimestamp) {
    return {
      valid: false,
      eventCount: events.length,
      firstInvalidEventId: invalidTimestamp.event.eventId,
      reason: 'audit_ledger_invalid_timestamp'
    };
  }

  const ordered = timestamped
    .sort((a, b) => (a.time - b.time) || compareCodeUnits(a.event.eventId, b.event.eventId))
    .map((item) => item.event);

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

    let digest: string;
    try {
      digest = await buildAuditLedgerDigest(current);
    } catch (error) {
      return {
        valid: false,
        eventCount: ordered.length,
        firstInvalidEventId: current.eventId,
        reason: error instanceof Error && error.message === 'audit_ledger_invalid_timestamp'
          ? 'audit_ledger_invalid_timestamp'
          : 'audit_ledger_invalid_digest'
      };
    }
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
