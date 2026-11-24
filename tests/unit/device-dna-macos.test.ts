import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { buildMacDeviceDnaReport, collectMacDeviceDnaReport } from '../../tools/local-agent/lib/device-dna-macos.mjs';

const input = { architecture: 'arm64', cpuModel: 'Apple M-series', logicalCores: 10, memoryBytes: 24 * 1024 ** 3, kernelRelease: '25.0.0', observedAt: '2026-11-21T00:00:00.000Z' };
const sorted = (v: any): any => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;

describe('ATLAS macOS Device DNA reference', () => {
  it('preserves unknown observations and never asserts hardware attestation', () => {
    const report = buildMacDeviceDnaReport(input);
    expect(report.operating_environment.platform).toBe('darwin');
    expect(report.runtime_profile).toBe('standard');
    expect(report.compute.local_ai_verified).toBe(false);
    expect(report.firmware.tpm_present).toBeNull();
    expect(report.firmware.secure_boot).toBe('unknown');
    expect(report.battery.present).toBeNull();
    expect(report.storage.observed).toBe(false);
    expect(report.integrity.hardware_attested).toBe(false);
    const { integrity, ...unsigned } = report;
    expect(integrity.content_digest_sha256).toBe(createHash('sha256').update(JSON.stringify(sorted(unsigned))).digest('hex'));
  });
  it('rejects invalid numeric observations', () => {
    expect(() => buildMacDeviceDnaReport({...input, memoryBytes: NaN})).toThrow();
    expect(() => buildMacDeviceDnaReport({...input, logicalCores: 0})).toThrow();
    expect(() => buildMacDeviceDnaReport({...input, logicalCores: 1.5})).toThrow();
  });
  it('does not copy unrelated input fields', () => {
    const report = buildMacDeviceDnaReport({...input, hostname:'private-fixture', serial_number:'private-fixture'} as any);
    expect(JSON.stringify(report)).not.toContain('private-fixture');
  });
  it('uses the existing Lite classification', () => {
    expect(buildMacDeviceDnaReport({...input, memoryBytes:4*1024**3}).runtime_profile).toBe('lite');
  });
  it('guards the native collector against other operating systems', async () => {
    if (process.platform !== 'darwin') await expect(collectMacDeviceDnaReport()).rejects.toThrow('device_dna_macos_only');
    else expect((await collectMacDeviceDnaReport()).operating_environment.platform).toBe('darwin');
  });
});
