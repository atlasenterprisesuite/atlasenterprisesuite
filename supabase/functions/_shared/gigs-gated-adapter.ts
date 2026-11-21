import type {
  MvnoCapability, MvnoMutationResult, MvnoProviderAdapter,
  MvnoProviderContext, MvnoProviderReadiness, MvnoProvisionRequest,
  MvnoProvisionResult, MvnoSubscriber
} from './mvno.ts';
import { assertMvnoProviderContext, requireMvnoPermission } from './mvno.ts';

/**
 * Gigs integration boundary. No live carrier requests are made until an
 * executed agreement, scoped credentials, tenant binding, and signed provider
 * evidence are independently verified. Never substitute sandbox responses.
 */
export class GigsProviderNotAuthorizedError extends Error {
  constructor() { super('gigs_provider_not_authorized'); }
}

export const GIGS_REQUIRED_PILOT_CAPABILITIES = [
  'esim', 'voice', 'sms_mms', 'mobile_data', 'hotspot',
  'number_management', 'usage_events', 'e911'
] as const satisfies readonly MvnoCapability[];

export class GigsGatedAdapter implements MvnoProviderAdapter {
  readonly providerId = 'gigs';
  readonly capabilities: ReadonlySet<MvnoCapability> = new Set();

  private authorize(context: MvnoProviderContext, permission: Parameters<typeof requireMvnoPermission>[1]): never {
    assertMvnoProviderContext(context);
    requireMvnoPermission(context, permission);
    throw new GigsProviderNotAuthorizedError();
  }

  async readiness(context: MvnoProviderContext): Promise<MvnoProviderReadiness> {
    assertMvnoProviderContext(context);
    requireMvnoPermission(context, 'wireless.mvno.read');
    return {
      state: 'pending_provider',
      blocker: 'gigs_wholesale_agreement_and_authenticated_adapter_required',
      checkedAt: new Date().toISOString(),
      capabilities: []
    };
  }

  async provision(context: MvnoProviderContext, _request: MvnoProvisionRequest): Promise<MvnoProvisionResult> {
    return this.authorize(context, 'wireless.mvno.provision');
  }
  async getSubscriber(context: MvnoProviderContext, _subscriberId: string): Promise<MvnoSubscriber> {
    return this.authorize(context, 'wireless.mvno.read');
  }
  async activate(context: MvnoProviderContext, _subscriberId: string): Promise<MvnoMutationResult> {
    return this.authorize(context, 'wireless.mvno.activate');
  }
  async suspend(context: MvnoProviderContext, _subscriberId: string): Promise<MvnoMutationResult> {
    return this.authorize(context, 'wireless.mvno.suspend');
  }
  async reconnect(context: MvnoProviderContext, _subscriberId: string): Promise<MvnoMutationResult> {
    return this.authorize(context, 'wireless.mvno.reconnect');
  }
  async revoke(context: MvnoProviderContext, _subscriberId: string): Promise<MvnoMutationResult> {
    return this.authorize(context, 'wireless.mvno.revoke');
  }
}
