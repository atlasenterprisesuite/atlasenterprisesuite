#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

if (process.env.RENDER !== 'true') process.exit(0);

const root = resolve('.atlas-render');
const runtimeDir = join(root, 'llama-b11046');
const modelDir = join(root, 'models');
const archive = join(root, 'llama-b11046-bin-ubuntu-x64.tar.gz');
const model = join(modelDir, 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
const llamaUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11046/llama-b11046-bin-ubuntu-x64.tar.gz';
const llamaSha256 = 'ca14dec04b4c5725b6373681cc3685c5dbb914301f7f8be6c89649c0a68734a9';
const modelUrl = 'https://huggingface.co/QuantFactory/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct.Q4_K_M.gguf?download=true';

mkdirSync(root, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });
mkdirSync(modelDir, { recursive: true });

function findFile(dir, basename) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isFile() && entry.name === basename) return target;
    if (entry.isDirectory()) {
      const nested = findFile(target, basename);
      if (nested) return nested;
    }
  }
  return null;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

let llamaServer = findFile(runtimeDir, 'llama-server');
if (!llamaServer) {
  execFileSync('curl', [
    '--fail',
    '--location',
    '--retry', '3',
    '--retry-delay', '2',
    '--output', archive,
    llamaUrl,
  ], { stdio: 'inherit' });

  if (!existsSync(archive) || sha256(archive) !== llamaSha256) {
    throw new Error('ATLAS Render llama.cpp release checksum verification failed');
  }

  execFileSync('tar', ['-xzf', archive, '-C', runtimeDir], { stdio: 'inherit' });
  llamaServer = findFile(runtimeDir, 'llama-server');
}
if (!llamaServer) throw new Error('ATLAS Render llama-server installation failed');
chmodSync(llamaServer, 0o755);

if (!existsSync(model) || statSync(model).size < 90_000_000) {
  execFileSync('curl', [
    '--fail',
    '--location',
    '--retry', '3',
    '--retry-delay', '2',
    '--output', model,
    modelUrl,
  ], { stdio: 'inherit' });
}
if (!existsSync(model) || statSync(model).size < 90_000_000) {
  throw new Error('ATLAS Render GGUF model download failed');
}

console.log('ATLAS Render local AI artifact ready');
