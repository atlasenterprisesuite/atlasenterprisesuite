import { describe, expect, it } from 'vitest';
import {
  normalizeNanpE164,
  validateForwardingRequest,
  TelecomError,
  UnavailableMifiAdapter,
  rulesMatch,
  type MifiDevice
} from '../../packages/telecom/src';

const scope = { tenantId: 'tenant-demo', organizationId: 'org-demo' };
const device: MifiDevice = {
  id: 'mifi-1',
  scope,
  displayName: 'Primary MiFi',
  carrierName: null,
  lineNumber: null,
  connectionState: 'connected',
  capabilities: {
    callForwarding: true,
    callForwardingReasons: ['all', 'busy', 'no-answer', 'not-reachable'],
    sms: false,
    ussd: false,
    atCommands: false,
    qmi: false,
    mbim: false
  }
};

describe('ATLAS Telecom MiFi domain', () => {
  it('normalizes US NANP inputs to E.164', () => {
    expect(normalizeNanpE164('786 555 0123')).toBe('+17865550123');
    expect(normalizeNanpE164('1-786-555-0123')).toBe('+17865550123');
    expect(normalizeNanpE164('+1 (786) 555-0123')).toBe('+17865550123');
  });

  it('rejects malformed destinations', () => {
    expect(() => normalizeNanpE164('555')).toThrowError(TelecomError);
  });

  it('accepts a supported forwarding request in the same tenant scope', () => {
    expect(validateForwardingRequest(device, {
      deviceId: device.id,
      scope,
      rule: { enabled: true, reason: 'all', destinationE164: '+17865550123' }
    }).rule.destinationE164).toBe('+17865550123');
  });

  it('rejects a forwarding reason the modem does not support', () => {
    const limited: MifiDevice = {
      ...device,
      capabilities: { ...device.capabilities, callForwardingReasons: ['all'] }
    };
    expect(() => validateForwardingRequest(limited, {
      deviceId: device.id,
      scope,
      rule: { enabled: true, reason: 'busy', destinationE164: '+17865550123' }
    })).toThrowError('CAPABILITY_UNSUPPORTED');
  });

  it('rejects no-answer seconds outside the allowed range', () => {
    expect(() => validateForwardingRequest(device, {
      deviceId: device.id,
      scope,
      rule: { enabled: true, reason: 'no-answer', destinationE164: '+17865550123', noAnswerSeconds: 31 }
    })).toThrowError('INVALID_DESTINATION');
  });

  it('rejects a tenant scope mismatch', () => {
    expect(() => validateForwardingRequest(device, {
      deviceId: device.id,
      scope: { tenantId: 'tenant-other', organizationId: 'org-other' },
      rule: { enabled: true, reason: 'all', destinationE164: '+17865550123' }
    })).toThrowError('SCOPE_MISMATCH');
  });

  it('unavailable adapter never accepts a forwarding write', async () => {
    const adapter = new UnavailableMifiAdapter();
    await expect(adapter.setCallForwarding({
      deviceId: 'mifi-1',
      scope,
      rule: { enabled: true, reason: 'all', destinationE164: '+17865550123' }
    })).rejects.toThrow('ADAPTER_UNAVAILABLE');
  });

  it('unavailable adapter never reports an empty forwarding read as a successful network query', async () => {
    const adapter = new UnavailableMifiAdapter();
    await expect(adapter.getCallForwarding('mifi-1', scope)).rejects.toThrow('ADAPTER_UNAVAILABLE');
  });

  it('marks verification as matching only when the network rule matches', () => {
    const expected = { enabled: true, reason: 'all' as const, destinationE164: '+17865550123' };
    expect(rulesMatch(expected, [{ ...expected }])).toBe(true);
    expect(rulesMatch(expected, [{ ...expected, destinationE164: '+14075550123' }])).toBe(false);
  });

  it('reports no modem capabilities from the repository default adapter', async () => {
    const adapter = new UnavailableMifiAdapter();
    const unavailable = await adapter.getDevice('primary-mifi', scope);
    expect(unavailable.connectionState).toBe('unavailable');
    expect(unavailable.capabilities.callForwarding).toBe(false);
    expect(unavailable.capabilities.callForwardingReasons).toEqual([]);
  });
});
