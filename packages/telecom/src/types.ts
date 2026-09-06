import type { TenantScope } from '../../core/src';

export type ForwardingReason = 'all' | 'busy' | 'no-answer' | 'not-reachable';
export type DeviceConnectionState = 'unavailable' | 'discovering' | 'connected' | 'error';
export type OperationState = 'idle' | 'submitting' | 'verified' | 'failed';
export type TelecomPermission = 'telecom.mifi.read' | 'telecom.mifi.forwarding.write';

export interface ModemCapabilities {
  callForwarding: boolean;
  callForwardingReasons: ForwardingReason[];
  sms: boolean;
  ussd: boolean;
  atCommands: boolean;
  qmi: boolean;
  mbim: boolean;
}

export interface MifiDevice {
  id: string;
  scope: TenantScope;
  displayName: string;
  carrierName: string | null;
  lineNumber: string | null;
  connectionState: DeviceConnectionState;
  capabilities: ModemCapabilities;
}

export interface CallForwardingRule {
  enabled: boolean;
  reason: ForwardingReason;
  destinationE164: string;
  noAnswerSeconds?: number;
}

export interface CallForwardingRequest {
  deviceId: string;
  scope: TenantScope;
  rule: CallForwardingRule;
}

export interface CallForwardingResult {
  requestId: string;
  accepted: boolean;
  verified: boolean;
  networkMessage: string | null;
  errorCode: string | null;
}
