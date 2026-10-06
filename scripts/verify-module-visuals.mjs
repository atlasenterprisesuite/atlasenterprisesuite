import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const REGISTRY_PATH = 'apps/web/src/modules/registry.ts';
const MANIFEST_PATH = 'apps/web/src/modules/integration/moduleVisuals.ts';
const PUBLIC_MODULE_ROOT = 'apps/web/public/atlas/visuals/modules';
const DERIVATIVE_WIDTHS = [640, 1280, 1920];
const MASTER_MIN_WIDTH = 2048;
const MASTER_MIN_HEIGHT = 1000;
const MASTER_MIN_BYTES = 24 * 1024;
const DERIVATIVE_MIN_BYTES = 4 * 1024;

function unique(values) {
  return [...new Set(values)];
}

function parseRegistryIds(source) {
  return unique(Array.from(source.matchAll(/\bid:\s*'([^']+)'/g), (match) => match[1]));
}

function parseManifestEntries(source) {
  const entries = [];
  const pattern = /'([^']+)'\s*:\s*defineVisual\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g;
  for (const match of source.matchAll(pattern)) {
    entries.push({ key: match[1], sourceId: match[2], family: match[3], focalPoint: match[4] });
  }
  return entries;
}

function parseFocalPoint(value) {
  const match = /^(\d{1,3})%\s+(\d{1,3})%$/.exec(value);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (x > 100 || y > 100) return null;
  return { x, y };
}

function readWebPDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) break;

    if (type === 'VP8X' && size >= 10) {
      const width = 1 + buffer.readUIntLE(data + 4, 3);
      const height = 1 + buffer.readUIntLE(data + 7, 3);
      return { width, height, format: 'webp' };
    }

    if (type === 'VP8L' && size >= 5 && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      const width = 1 + b1 + ((b2 & 0x3f) << 8);
      const height = 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10);
      return { width, height, format: 'webp' };
    }

    if (type === 'VP8 ' && size >= 10 && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      const width = buffer.readUInt16LE(data + 6) & 0x3fff;
      const height = buffer.readUInt16LE(data + 8) & 0x3fff;
      return { width, height, format: 'webp' };
    }

    offset = data + size + (size % 2);
  }
  return null;
}

function readAvifDimensions(buffer) {
  const candidates = [];
  let offset = 0;
  while (offset <= buffer.length - 20) {
    const index = buffer.indexOf('ispe', offset, 'ascii');
    if (index === -1) break;
    if (index >= 4 && index + 16 <= buffer.length) {
      const width = buffer.readUInt32BE(index + 8);
      const height = buffer.readUInt32BE(index + 12);
      if (width > 0 && height > 0 && width < 100000 && height < 100000) {
        candidates.push({ width, height, format: 'avif' });
      }
    }
    offset = index + 4;
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
}

export function readImageDimensions(buffer) {
  return readWebPDimensions(buffer) ?? readAvifDimensions(buffer);
}

async function inspectImage(path) {
  const buffer = await readFile(path);
  const dimensions = readImageDimensions(buffer);
  return {
    buffer,
    bytes: buffer.byteLength,
    hash: createHash('sha256').update(buffer).digest('hex'),
    dimensions
  };
}

export async function verifyModuleVisualCollection({
  rootDir = DEFAULT_ROOT,
  registrySource,
  manifestSource
} = {}) {
  const errors = [];
  const registry = registrySource ?? await readFile(join(rootDir, REGISTRY_PATH), 'utf8');
  const manifest = manifestSource ?? await readFile(join(rootDir, MANIFEST_PATH), 'utf8');
  const moduleIds = parseRegistryIds(registry);
  const entries = parseManifestEntries(manifest);
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  if (!moduleIds.length) errors.push('canonical registry contains no module IDs');
  if (!entries.length) errors.push('module visual manifest contains no explicit visual entries');

  for (const id of moduleIds) {
    if (!byKey.has(id)) errors.push(`${id}: missing visual metadata`);
  }

  for (const entry of entries) {
    if (!moduleIds.includes(entry.key)) errors.push(`${entry.key}: visual metadata has no canonical module`);
    if (entry.key !== entry.sourceId) errors.push(`${entry.key}: visual metadata maps to ${entry.sourceId} instead of its own identity`);
    if (!parseFocalPoint(entry.focalPoint)) errors.push(`${entry.key}: invalid focal point ${entry.focalPoint}`);
  }

  const sourceOwners = new Map();
  for (const entry of entries) {
    const owners = sourceOwners.get(entry.sourceId) ?? [];
    owners.push(entry.key);
    sourceOwners.set(entry.sourceId, owners);
  }
  for (const [sourceId, owners] of sourceOwners) {
    if (owners.length > 1) errors.push(`${sourceId}: duplicate visual source identity used by ${owners.join(', ')}`);
  }

  const masterHashes = new Map();

  for (const id of moduleIds) {
    const base = join(rootDir, PUBLIC_MODULE_ROOT, id);
    const expected = [
      { name: 'master.webp', width: null, format: 'webp', minBytes: MASTER_MIN_BYTES },
      ...DERIVATIVE_WIDTHS.flatMap((width) => [
        { name: `cover-${width}.avif`, width, format: 'avif', minBytes: DERIVATIVE_MIN_BYTES },
        { name: `cover-${width}.webp`, width, format: 'webp', minBytes: DERIVATIVE_MIN_BYTES }
      ])
    ];

    let masterRatio = null;
    for (const asset of expected) {
      const path = join(base, asset.name);
      if (!existsSync(path)) {
        errors.push(`${id}: missing asset ${asset.name}`);
        continue;
      }

      let inspection;
      try {
        inspection = await inspectImage(path);
      } catch (error) {
        errors.push(`${id}/${asset.name}: unreadable asset (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }

      const { bytes, dimensions, hash } = inspection;
      if (!dimensions) {
        errors.push(`${id}/${asset.name}: unsupported or corrupt image metadata`);
        continue;
      }
      if (dimensions.format !== asset.format) {
        errors.push(`${id}/${asset.name}: expected ${asset.format}, detected ${dimensions.format}`);
      }
      if (bytes < asset.minBytes) {
        errors.push(`${id}/${asset.name}: suspiciously tiny asset ${bytes} bytes < ${asset.minBytes}`);
      }

      if (asset.name === 'master.webp') {
        if (dimensions.width < MASTER_MIN_WIDTH) {
          errors.push(`${id}: master width ${dimensions.width} < ${MASTER_MIN_WIDTH}`);
        }
        if (dimensions.height < MASTER_MIN_HEIGHT) {
          errors.push(`${id}: master height ${dimensions.height} < ${MASTER_MIN_HEIGHT}`);
        }
        masterRatio = dimensions.width / dimensions.height;
        const owners = masterHashes.get(hash) ?? [];
        owners.push(id);
        masterHashes.set(hash, owners);
      } else if (dimensions.width !== asset.width) {
        errors.push(`${id}/${asset.name}: width ${dimensions.width} != ${asset.width}`);
      }

      if (masterRatio && asset.name !== 'master.webp') {
        const ratio = dimensions.width / dimensions.height;
        if (Math.abs(ratio - masterRatio) > 0.02) {
          errors.push(`${id}/${asset.name}: aspect ratio ${ratio.toFixed(3)} drifts from master ${masterRatio.toFixed(3)}`);
        }
      }
    }
  }

  for (const owners of masterHashes.values()) {
    if (owners.length > 1) errors.push(`duplicate master artwork assigned to unrelated modules: ${owners.join(', ')}`);
  }

  return { ok: errors.length === 0, errors, moduleCount: moduleIds.length };
}

async function main() {
  const result = await verifyModuleVisualCollection();
  if (!result.ok) {
    console.error('ATLAS IMAGE QUALITY GATE failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`ATLAS IMAGE QUALITY GATE passed for ${result.moduleCount} canonical modules.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await main();
}
