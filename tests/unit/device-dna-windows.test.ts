import { describe, expect, it } from 'vitest';
import {
  classifyWindowsDeviceDnaProfile,
  collectWindowsDeviceDnaReport,
  windowsDeviceDnaLocalDevice
} from '../../tools/local-agent/lib/device-dna-windows.mjs';

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

describe('ATLAS Windows Device DNA reference collector', () => {
  it('keeps constrained hardware on the Lite runtime profile', () => {
    expect(classifyWindowsDeviceDnaProfile({ memoryGb: 4, logicalCores: 4 })).toBe('lite');
    expect(classifyWindowsDeviceDnaProfile({ memoryGb: 8, logicalCores: 2 })).toBe('lite');
  });

  it('requires verified local AI capability before selecting Performance', () => {
    expect(classifyWindowsDeviceDnaProfile({
      memoryGb: 32,
      logicalCores: 12,
      localAiVerified: false
    })).toBe('standard');

    expect(classifyWindowsDeviceDnaProfile({
      memoryGb: 32,
      logicalCores: 12,
      localAiVerified: true
    })).toBe('performance');
  });

  it('registers the host as a read-only Windows Device DNA adapter', () => {
    const device = windowsDeviceDnaLocalDevice({
      schema_version: 'atlas.device-dna.v1',
      evidence_level: 'agent-observed'
    });

    expect(device.adapter).toBe('device-dna-windows');
    expect(device.capabilities).toEqual(['device.dna.read']);
    expect(device.health_status).toBe('unknown');
  });

  if (process.platform === 'win32') {
    it('collects bounded Windows evidence without hardware-attestation or inferred firmware claims', async () => {
      const report = await collectWindowsDeviceDnaReport({
        observedAt: '2026-10-07T00:00:00.000Z'
      });

      expect(report.schema_version).toBe('atlas.device-dna.v1');
      expect(report.evidence_level).toBe('agent-observed');
      expect(report.integrity.algorithm).toBe('sha256');
      expect(report.integrity.content_digest_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.integrity.hardware_attested).toBe(false);
      expect(report.compute.logical_cores).toBeGreaterThan(0);
      expect(report.compute.memory_gb).toBeGreaterThan(0);
      expect(report.firmware.boot_mode).toBe('legacy-or-unknown');
      expect(report.firmware.secure_boot).toBe('unknown');
      expect(report.firmware.tpm_present).toBe(false);
      expect(report.storage.observed).toBe(false);

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
