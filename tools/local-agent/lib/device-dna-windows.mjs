import os from 'node:os';
import { createHash } from 'node:crypto';

function safeText(value, max = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function contentDigest(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function classifyWindowsDeviceDnaProfile({ memoryGb, logicalCores, localAiVerified = false }) {
  if (finiteNumber(memoryGb) <= 4 || finiteNumber(logicalCores) <= 2) return 'lite';
  if (finiteNumber(memoryGb) >= 16 && finiteNumber(logicalCores) >= 8 && localAiVerified === true) {
    return 'performance';
  }
  return 'standard';
}

export async function collectWindowsDeviceDnaReport({
  localAiVerified = false,
  observedAt = new Date().toISOString()
} = {}) {
  if (process.platform !== 'win32') throw new Error('device_dna_windows_only');

  const cpus = os.cpus();
  const memoryGb = Number((os.totalmem() / (1024 ** 3)).toFixed(1));
  const logicalCores = cpus.length;

  const report = {
    schema_version: 'atlas.device-dna.v1',
    evidence_level: 'agent-observed',
    observed_at: safeText(observedAt, 64),
    runtime_profile: classifyWindowsDeviceDnaProfile({ memoryGb, logicalCores, localAiVerified }),
    system: {
      manufacturer: null,
      product_name: null,
      product_version: null
    },
    compute: {
      architecture: safeText(os.arch(), 40),
      cpu_model: safeText(cpus[0]?.model || 'unknown', 180),
      logical_cores: logicalCores,
      memory_gb: memoryGb,
      local_ai_verified: localAiVerified === true
    },
    operating_environment: {
      platform: 'win32',
      kernel_release: safeText(os.release(), 120)
    },
    firmware: {
      boot_mode: 'legacy-or-unknown',
      secure_boot: 'unknown',
      tpm_present: false
    },
    storage: {
      source: 'node-os',
      observed: false,
      disks: []
    },
    battery: {
      present: false,
      state: 'unknown',
      capacity_percent: null
    },
    privacy_boundary: {
      excludes: [
        'serial_numbers',
        'product_uuid',
        'mac_addresses',
        'ip_addresses',
        'usernames',
        'hostnames',
        'mount_paths'
      ]
    }
  };

  return {
    ...report,
    integrity: {
      algorithm: 'sha256',
      content_digest_sha256: contentDigest(report),
      hardware_attested: false
    }
  };
}

export function windowsDeviceDnaLocalDevice(report) {
  return {
    external_id: 'atlas-host-device-dna',
    label: 'ATLAS Host Device DNA',
    device_type: 'computer',
    adapter: 'device-dna-windows',
    capabilities: ['device.dna.read'],
    health_status: 'unknown',
    metadata: { device_dna: report }
  };
}
