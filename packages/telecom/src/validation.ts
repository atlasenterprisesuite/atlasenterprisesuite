import { sameScope } from '../../core/src';
import { TelecomError } from './errors';
import type { CallForwardingRequest, MifiDevice } from './types';

export function normalizeNanpE164(input: string) {
  const compact = input.trim().replace(/[\s().-]/g, '');
  if (/^\+1\d{10}$/.test(compact)) return compact;
  if (/^1\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\d{10}$/.test(compact)) return `+1${compact}`;
  throw new TelecomError('INVALID_DESTINATION', 'Enter a valid 10-digit US/Canada number.');
}

export function validateForwardingRequest(device: MifiDevice, request: CallForwardingRequest) {
  if (!sameScope(device.scope, request.scope)) {
    throw new TelecomError('SCOPE_MISMATCH', 'Device and request must belong to the active ATLAS scope.');
  }
  if (device.id !== request.deviceId) {
    throw new TelecomError('DEVICE_NOT_FOUND', 'The selected MiFi does not match this request.');
  }
  if (!device.capabilities.callForwarding || !device.capabilities.callForwardingReasons.includes(request.rule.reason)) {
    throw new TelecomError('CAPABILITY_UNSUPPORTED', 'This MiFi does not report support for the requested forwarding mode.');
  }
  const destinationE164 = normalizeNanpE164(request.rule.destinationE164);
  if (request.rule.reason === 'no-answer') {
    const seconds = request.rule.noAnswerSeconds;
    if (!Number.isInteger(seconds) || seconds! < 5 || seconds! > 30) {
      throw new TelecomError('INVALID_DESTINATION', 'No-answer delay must be an integer from 5 through 30 seconds.');
    }
  }
  return { ...request, rule: { ...request.rule, destinationE164 } };
}
