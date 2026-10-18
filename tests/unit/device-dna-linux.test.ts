import { describe, expect, it } from 'vitest';
import {
  classifyDeviceDnaProfile,
  collectLinuxDeviceDnaReport,
  deviceDnaLocalDevice
} from '../../tools/local-agent/lib/device-dna-linux.mjs';

function objectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) objectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key.toLowerCase());
    objectKeys(nested, keys);
  }
  return keys;
}

describe('ATLAS Linux Device DNA reference collector', () => {
  it('keeps constrained hardware on the Lite runtime profile', () => {
    expect(classifyDeviceDnaProfile({ memoryGb: 4, logicalCores: 4 })).toBe('lite');
    expect(classifyDeviceDnaProfile({ memoryGb: 8, logicalCores: 2 })).toBe('lite');
  });

  it('requires verified local AI capability before selecting Performance', () => {
    expect(classifyDeviceDnaProfile({
      memoryGb: 32,
      logicalCores: 12,
      localAiVerified: false
    })).toBe('standard');

    expect(classifyDeviceDnaProfile({
      memoryGb: 32,
      logicalCores: 12,
      localAiVerified: true
    })).toBe('performance');
  });

  it('registers the host as a read-only Device DNA adapter', () => {
    const device = deviceDnaLocalDevice({
      schema_version: 'atlas.device-dna.v1',
      evidence_level: 'agent-observed'
    });

    expect(device.adapter).toBe('device-dna-linux');
    expect(device.capabilities).toEqual(['device.dna.read']);
    expect(device.health_status).toBe('unknown');
  });

  if (process.platform === 'linux') {
    it('collects bounded Linux evidence without hardware-attestation claims or identity keys', async () => {
      const report = await collectLinuxDeviceDnaReport({
        observedAt: '2026-10-01T00:00:00.000Z'
      });

      expect(report.schema_version).toBe('atlas.device-dna.v1');
      expect(report.evidence_level).toBe('agent-observed');
      expect(report.integrity.algorithm).toBe('sha256');
      expect(report.integrity.content_digest_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.integrity.hardware_attested).toBe(false);
      expect(report.compute.logical_cores).toBeGreaterThan(0);
      expect(report.compute.memory_gb).toBeGreaterThan(0);

      const keys = objectKeys(report);
      for (const forbidden of [
        'serial',
        'serial_number',
        'product_uuid',
        'uuid',
        'mac',
        'mac_address',
        'ip',
        'ip_address',
        'hostname',
        'username',
        'mountpoint',
        'mount_path'
      ]) {
        expect(keys.has(forbidden)).toBe(false);
      }
    });
  }
});
