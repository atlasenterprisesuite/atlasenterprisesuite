export type MvnoSubscriberState =
  | 'not_configured'
  | 'pending_provider'
  | 'provisioning'
  | 'active'
  | 'degraded'
  | 'offline'
  | 'suspended'
  | 'revoked';

export type MvnoCapability =
  | 'esim'
  | 'voice'
  | 'sms_mms'
  | 'mobile_data'
  | 'hotspot'
  | 'number_management'
  | 'usage_events'
  | 'e911';

export interface MvnoSubscriberIdentifiers {
  eid?: string;
  iccid?: string;
  imsi?: string;
  msisdn?: string;
}

export interface MvnoSubscriber {
  id: string;
  state: MvnoSubscriberState;
  identifiers: MvnoSubscriberIdentifiers;
  provider?: string;
  lastVerifiedAt?: string;
}

export interface MvnoProvisionRequest {
  subscriberId: string;
  eid?: string;
  requestedCapabilities: MvnoCapability[];
}

export interface MvnoProvisionResult {
  subscriber: MvnoSubscriber;
  activationCode?: string;
}

export interface MvnoProviderAdapter {
  readonly providerId: string;
  readonly capabilities: ReadonlySet<MvnoCapability>;

  provision(request: MvnoProvisionRequest): Promise<MvnoProvisionResult>;
  getSubscriber(subscriberId: string): Promise<MvnoSubscriber>;
  activate(subscriberId: string): Promise<MvnoSubscriber>;
  suspend(subscriberId: string): Promise<MvnoSubscriber>;
  reconnect(subscriberId: string): Promise<MvnoSubscriber>;
  revoke(subscriberId: string): Promise<MvnoSubscriber>;
}
