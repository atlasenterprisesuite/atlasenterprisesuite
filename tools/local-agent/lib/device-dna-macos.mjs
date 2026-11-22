import os from 'node:os';
import { createHash } from 'node:crypto';
import { classifyDeviceDnaProfile } from './device-dna-linux.mjs';

const safeText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

// Pure report construction; fixtures produced here are not enrolled-device evidence.
// Native collection is read-only, has no subprocesses, network or filesystem access.
export function buildMacDeviceDnaReport({ architecture, cpuModel, logicalCores, memoryBytes, kernelRelease, observedAt }) {
  const memoryGb = Number((memoryBytes / (1024 ** 3)).toFixed(1));
  if (!Number.isFinite(memoryBytes) || !Number.isFinite(memoryGb) || memoryGb <= 0 || memoryGb > 4096 ||
      !Number.isInteger(logicalCores) || logicalCores < 1 || logicalCores > 1024 ||
      typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) {
    throw new Error('device_dna_macos_observation_invalid');
  }
  const report = {
    schema_version: 'atlas.device-dna.v1',
    evidence_level: 'agent-observed',
    observed_at: new Date(observedAt).toISOString(),
    runtime_profile: classifyDeviceDnaProfile({ memoryGb, logicalCores, localAiVerified: false }),
    system: { manufacturer: null, product_name: null, product_version: null },
    compute: {
      architecture: safeText(architecture, 40) || 'unknown',
      cpu_model: safeText(cpuModel, 180) || 'unknown',
      logical_cores: logicalCores,
      memory_gb: memoryGb,
      local_ai_verified: false
    },
    operating_environment: { platform: 'darwin', kernel_release: safeText(kernelRelease, 120) || 'unknown' },
    firmware: { boot_mode: 'legacy-or-unknown', secure_boot: 'unknown', tpm_present: null },
    storage: { source: 'node-os', observed: false, disks: [] },
    battery: { present: null, state: 'unknown', capacity_percent: null },
    privacy_boundary: { excludes: ['serial_numbers','product_uuid','mac_addresses','ip_addresses','usernames','hostnames','mount_paths'] }
  };
  return { ...report, integrity: {
    algorithm: 'sha256',
    content_digest_sha256: createHash('sha256').update(JSON.stringify(stableValue(report))).digest('hex'),
    hardware_attested: false
  }};
}

export async function collectMacDeviceDnaReport() {
  if (process.platform !== 'darwin') throw new Error('device_dna_macos_only');
  const cpus = os.cpus();
  return buildMacDeviceDnaReport({
    architecture: os.arch(),
    cpuModel: cpus[0]?.model,
    logicalCores: cpus.length,
    memoryBytes: os.totalmem(),
    kernelRelease: os.release(),
    observedAt: new Date().toISOString()
  });
}

// Do not register this collector with Local Agent or accept it at the backend
// until platform binding, unknown-field UI semantics and native CI are verified.
