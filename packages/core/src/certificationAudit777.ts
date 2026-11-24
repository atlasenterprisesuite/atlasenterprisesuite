import { certifyIntegration, readinessNotification, type ReadinessInput, type ReadinessResult } from './integrationReadiness777';

export type CertificationAuditEvent = {
  eventId: string; moduleId: string; sha: string; state: string; blockers: readonly string[];
  kind: 'milestone' | 'authorization_blocker'; createdAt: string;
};
export type ReadinessLedger = {
  load: (moduleId: string) => Promise<ReadinessResult | null>;
  appendIfAbsent: (event: CertificationAuditEvent) => Promise<boolean>;
  save: (current: ReadinessResult) => Promise<void>;
};
const shaPattern = /^[a-f0-9]{40}$/;
/** Durable ledger is injected: no notification is delivered or claimed unless the append succeeds. */
export async function reconcileCertification(input: ReadinessInput, ledger: ReadinessLedger, now: string) {
  const current = certifyIntegration(input);
  if (!current.moduleId || !current.sha || !shaPattern.test(current.sha) || !Number.isFinite(Date.parse(now)))
    return { status: 'blocked' as const, reason: 'INVALID_EVIDENCE', current };
  try {
    const previous = await ledger.load(current.moduleId);
    const notification = readinessNotification(previous, current);
    if (notification) {
      const kind = notification.blockers.includes('AUTHORIZATION_REQUIRED') ? 'authorization_blocker' : 'milestone';
      const event: CertificationAuditEvent = {
        eventId: [current.moduleId, current.sha, current.state, kind].join(':'),
        moduleId: current.moduleId, sha: current.sha, state: current.state,
        blockers: [...current.blockers], kind, createdAt: now
      };
      if (await ledger.appendIfAbsent(event) !== true)
        return { status: 'blocked' as const, reason: 'AUDIT_WRITE_UNCONFIRMED', current };
    }
    await ledger.save(current);
    return { status: 'recorded' as const, current, notification: notification ?? null };
  } catch {
    return { status: 'blocked' as const, reason: 'LEDGER_UNAVAILABLE', current };
  }
}
