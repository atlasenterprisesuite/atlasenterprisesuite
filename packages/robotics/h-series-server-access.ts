import type { ExecutionActor, ExecutionScope } from '../execution/src/types';
import { readHSeriesCatalog, type HSeriesCatalogResult } from './h-series-catalog';

/** Server-only authorization boundary; never accept an actor from a client request. */
export interface VerifiedRoboticsSession {
  /** Identity verified by the server, not from request JSON. */
  userId: string;
  tenantId: string;
  organizationId: string;
}
export interface RoboticsAuthorizationProvider {
  verifiedSession(): Promise<VerifiedRoboticsSession | null>;
  /** Must check authoritative membership, tenant/org binding and effective permission at read time. */
  canReadCatalog(session: VerifiedRoboticsSession): Promise<boolean>;
}

/** No physical control, SQL credentials, service_role, or client-side fallback. */
export async function readAuthorizedHSeriesCatalog(
  provider: RoboticsAuthorizationProvider,
  requestedScope: ExecutionScope
): Promise<HSeriesCatalogResult> {
  try {
    const session = await provider.verifiedSession();
    if (!session || !session.userId || !session.tenantId || !session.organizationId ||
        session.tenantId !== requestedScope?.tenantId ||
        session.organizationId !== requestedScope?.organizationId) {
      return { ok: false, reason: 'forbidden' };
    }
    const actor: ExecutionActor = {
      userId: session.userId,
      scope: { tenantId: session.tenantId, organizationId: session.organizationId },
      permissions: ['execution.read']
    };
    return readHSeriesCatalog(actor, requestedScope, async () => provider.canReadCatalog(session));
  } catch {
    return { ok: false, reason: 'authorization_unavailable' };
  }
}
