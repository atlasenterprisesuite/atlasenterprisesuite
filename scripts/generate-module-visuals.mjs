import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const WIDTHS = [640, 1280, 1920];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.error?.code === 'ENOENT') {
    fail('ffmpeg is required to generate ATLAS module visual derivatives.');
  }
  if (result.status !== 0) {
    fail(`ffmpeg failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function renderWebp(source, output, width, quality = 90) {
  runFfmpeg([
    '-i', source,
    '-vf', `scale=${width}:-2:flags=lanczos`,
    '-frames:v', '1',
    '-c:v', 'libwebp',
    '-quality', String(quality),
    '-compression_level', '6',
    output
  ]);
}

function renderAvif(source, output, width) {
  runFfmpeg([
    '-i', source,
    '-vf', `scale=${width}:-2:flags=lanczos`,
    '-frames:v', '1',
    '-c:v', 'libaom-av1',
    '-still-picture', '1',
    '-crf', '24',
    '-cpu-used', '6',
    output
  ]);
}

const [moduleId, sourceArg] = process.argv.slice(2);
if (!moduleId || !sourceArg) {
  fail('Usage: node scripts/generate-module-visuals.mjs <module-id> <source-image>');
}
if (!/^[a-z0-9-]+$/.test(moduleId)) {
  fail(`Invalid module id: ${moduleId}`);
}

const source = resolve(process.cwd(), sourceArg);
const outputDir = resolve(ROOT, 'apps/web/public/atlas/visuals/modules', moduleId);
mkdirSync(outputDir, { recursive: true });

renderWebp(source, resolve(outputDir, 'master.webp'), 2048, 94);
for (const width of WIDTHS) {
  renderWebp(source, resolve(outputDir, `cover-${width}.webp`), width, 90);
  renderAvif(source, resolve(outputDir, `cover-${width}.avif`), width);
}

console.log(`Generated ATLAS visual derivatives for ${moduleId}.`);
