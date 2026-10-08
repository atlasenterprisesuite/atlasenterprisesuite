import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateEvidenceBundle } from '../../packages/core/src/evidence.ts';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  const input = argv[2];
  if (!input) throw new Error('usage: build-evidence-manifest.mjs <bundle.json> [output.json] [artifact...]');
  return {
    input: resolve(input),
    output: resolve(argv[3] || 'artifacts/evidence/evidence-manifest.json'),
    artifacts: argv.slice(4).map((value) => resolve(value))
  };
}

const { input, output, artifacts } = parseArgs(process.argv);
const sourceBytes = readFileSync(input);
const bundle = JSON.parse(sourceBytes.toString('utf8'));
const evaluation = evaluateEvidenceBundle(bundle);

const files = [input, ...artifacts].map((path) => {
  const bytes = readFileSync(path);
  return {
    path,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
});

const manifest = {
  version: 1,
  engine: 'atlas-evidence-engine',
  generatedAt: new Date().toISOString(),
  subject: bundle.subject,
  environment: bundle.environment,
  mode: bundle.mode,
  evaluation,
  source: {
    path: input,
    sha256: sha256(sourceBytes)
  },
  files
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');

if (bundle.mode === 'fail-closed' && !evaluation.productionReady) {
  process.exit(1);
}
