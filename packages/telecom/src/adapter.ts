import type { TenantScope } from '../../core/src';
import { TelecomError } from './errors';
import type {
  CallForwardingRequest,
  CallForwardingResult,
  CallForwardingRule,
  MifiDevice,
  ModemCapabilities
} from './types';

export interface MifiAdapter {
  getDevice(deviceId: string, scope: TenantScope): Promise<MifiDevice>;
  getCallForwarding(deviceId: string, scope: TenantScope): Promise<CallForwardingRule[]>;
  setCallForwarding(request: CallForwardingRequest): Promise<CallForwardingResult>;
  verifyCallForwarding(deviceId: string, scope: TenantScope): Promise<CallForwardingRule[]>;
}

const noCapabilities: ModemCapabilities = {
  callForwarding: false,
  callForwardingReasons: [],
  sms: false,
  ussd: false,
  atCommands: false,
  qmi: false,
  mbim: false
};

export class UnavailableMifiAdapter implements MifiAdapter {
  async getDevice(deviceId: string, scope: TenantScope): Promise<MifiDevice> {
    return {
      id: deviceId,
      scope,
      displayName: 'MiFi device',
      carrierName: null,
      lineNumber: null,
      connectionState: 'unavailable',
      capabilities: { ...noCapabilities, callForwardingReasons: [] }
    };
  }

  async getCallForwarding(_deviceId: string, _scope: TenantScope): Promise<CallForwardingRule[]> {
    throw new TelecomError('ADAPTER_UNAVAILABLE', 'No authorized MiFi device adapter is connected.');
  }

  async setCallForwarding(_request: CallForwardingRequest): Promise<CallForwardingResult> {
    throw new TelecomError('ADAPTER_UNAVAILABLE', 'No authorized MiFi device adapter is connected.');
  }

  async verifyCallForwarding(_deviceId: string, _scope: TenantScope): Promise<CallForwardingRule[]> {
    throw new TelecomError('ADAPTER_UNAVAILABLE', 'No authorized MiFi device adapter is connected.');
  }
}

export function rulesMatch(expected: CallForwardingRule, actual: CallForwardingRule[]) {
  return actual.some((rule) =>
    rule.enabled === expected.enabled &&
    rule.reason === expected.reason &&
    rule.destinationE164 === expected.destinationE164 &&
    rule.noAnswerSeconds === expected.noAnswerSeconds
  );
}
