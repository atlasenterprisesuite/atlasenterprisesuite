import os from 'node:os';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

function safeText(value, max = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function readOptional(path, max = 160) {
  try {
    return safeText(await fs.readFile(path, 'utf8'), max) || null;
  } catch {
    return null;
  }
}

async function pathExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
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

export function classifyDeviceDnaProfile({ memoryGb, logicalCores, localAiVerified = false }) {
  if (finiteNumber(memoryGb) <= 4 || finiteNumber(logicalCores) <= 2) return 'lite';
  if (finiteNumber(memoryGb) >= 16 && finiteNumber(logicalCores) >= 8 && localAiVerified === true) {
    return 'performance';
  }
  return 'standard';
}

async function collectStorage() {
  try {
    const names = (await fs.readdir('/sys/block')).filter((name) => !name.startsWith('loop')).slice(0, 16);
    const disks = [];
    for (const name of names) {
      const [sectors, rotational, model, vendor] = await Promise.all([
        readOptional(`/sys/block/${name}/size`, 32),
        readOptional(`/sys/block/${name}/queue/rotational`, 8),
        readOptional(`/sys/block/${name}/device/model`, 160),
        readOptional(`/sys/block/${name}/device/vendor`, 80)
      ]);
      disks.push({
        name: safeText(name, 80),
        model,
        vendor,
        size_bytes: Math.max(0, finiteNumber(sectors) * 512),
        rotational: rotational === '1'
      });
    }
    return { source: 'sysfs', observed: true, disks };
  } catch {
    return { source: 'sysfs', observed: false, disks: [] };
  }
}

async function collectSecureBoot() {
  try {
    const directory = '/sys/firmware/efi/efivars';
    const names = await fs.readdir(directory);
    const secureBoot = names.find((name) => /^SecureBoot-/i.test(name));
    if (!secureBoot) return 'unknown';
    const value = await fs.readFile(`${directory}/${secureBoot}`);
    if (value.length < 5) return 'unknown';
    return value[4] === 1 ? 'enabled' : 'disabled';
  } catch {
    return 'unknown';
  }
}

async function collectBattery() {
  try {
    const directory = '/sys/class/power_supply';
    const names = await fs.readdir(directory);
    for (const name of names.slice(0, 32)) {
      const base = `${directory}/${name}`;
      const type = await readOptional(`${base}/type`, 40);
      if (type?.toLowerCase() !== 'battery') continue;
      const capacityRaw = await readOptional(`${base}/capacity`, 12);
      const capacity = Number(capacityRaw);
      return {
        present: true,
        state: (await readOptional(`${base}/status`, 40)) || 'unknown',
        capacity_percent: Number.isFinite(capacity) ? Math.max(0, Math.min(100, Math.round(capacity))) : null
      };
    }
  } catch {}
  return { present: false, state: 'unknown', capacity_percent: null };
}

async function collectDmi() {
  return {
    manufacturer: await readOptional('/sys/class/dmi/id/sys_vendor', 160),
    product_name: await readOptional('/sys/class/dmi/id/product_name', 160),
    product_version: await readOptional('/sys/class/dmi/id/product_version', 160)
  };
}

export async function collectLinuxDeviceDnaReport({
  localAiVerified = false,
  observedAt = new Date().toISOString()
} = {}) {
  if (process.platform !== 'linux') throw new Error('device_dna_linux_only');

  const cpus = os.cpus();
  const memoryGb = Number((os.totalmem() / (1024 ** 3)).toFixed(1));
  const logicalCores = cpus.length;
  const [storage, secureBoot, battery, dmi, efiPresent, tpmPresent] = await Promise.all([
    collectStorage(),
    collectSecureBoot(),
    collectBattery(),
    collectDmi(),
    pathExists('/sys/firmware/efi'),
    pathExists('/sys/class/tpm/tpm0')
  ]);

  const report = {
    schema_version: 'atlas.device-dna.v1',
    evidence_level: 'agent-observed',
    observed_at: safeText(observedAt, 64),
    runtime_profile: classifyDeviceDnaProfile({ memoryGb, logicalCores, localAiVerified }),
    system: {
      manufacturer: dmi.manufacturer,
      product_name: dmi.product_name,
      product_version: dmi.product_version
    },
    compute: {
      architecture: safeText(os.arch(), 40),
      cpu_model: safeText(cpus[0]?.model || 'unknown', 180),
      logical_cores: logicalCores,
      memory_gb: memoryGb,
      local_ai_verified: localAiVerified === true
    },
    operating_environment: {
      platform: 'linux',
      kernel_release: safeText(os.release(), 120)
    },
    firmware: {
      boot_mode: efiPresent ? 'uefi' : 'legacy-or-unknown',
      secure_boot: secureBoot,
      tpm_present: tpmPresent
    },
    storage,
    battery,
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

export function deviceDnaLocalDevice(report) {
  return {
    external_id: 'atlas-host-device-dna',
    label: 'ATLAS Host Device DNA',
    device_type: 'computer',
    adapter: 'device-dna-linux',
    capabilities: ['device.dna.read'],
    health_status: 'unknown',
    metadata: { device_dna: report }
  };
}
