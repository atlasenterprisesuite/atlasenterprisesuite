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
const whisperRuntimeDir = join(root, 'whisper-b5130');
const modelDir = join(root, 'models');
const archive = join(root, 'llama-b11046-bin-ubuntu-x64.tar.gz');
const whisperArchive = join(root, 'whisper-b5130-bin-ubuntu-x64.tar.gz');
const model = join(modelDir, 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
const whisperModel = join(modelDir, 'ggml-tiny.bin');
const llamaUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11046/llama-b11046-bin-ubuntu-x64.tar.gz';
const llamaSha256 = 'ca14dec04b4c5725b6373681cc3685c5dbb914301f7f8be6c89649c0a68734a9';
const modelUrl = 'https://huggingface.co/QuantFactory/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct.Q4_K_M.gguf?download=true';
const whisperUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-ubuntu-x64.tar.gz';
const whisperSha256 = '53e7fd8b5764edad916b8848dd0af6abb1ff1d3b86c899e79c78652412536c32';
const whisperModelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin';
const whisperModelSha1 = 'bd577a113a864445d4c299885e0cb97d4ba92b5f';

mkdirSync(root, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });
mkdirSync(whisperRuntimeDir, { recursive: true });
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

function sha1(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex');
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

let whisperCli = findFile(whisperRuntimeDir, 'whisper-cli');
if (!whisperCli) {
  execFileSync('curl', [
    '--fail',
    '--location',
    '--retry', '3',
    '--retry-delay', '2',
    '--output', whisperArchive,
    whisperUrl,
  ], { stdio: 'inherit' });

  if (!existsSync(whisperArchive) || sha256(whisperArchive) !== whisperSha256) {
    throw new Error('ATLAS Render whisper.cpp release checksum verification failed');
  }

  execFileSync('tar', ['-xzf', whisperArchive, '-C', whisperRuntimeDir], { stdio: 'inherit' });
  whisperCli = findFile(whisperRuntimeDir, 'whisper-cli');
}
if (!whisperCli) throw new Error('ATLAS Render whisper-cli installation failed');
chmodSync(whisperCli, 0o755);

if (!existsSync(whisperModel) || statSync(whisperModel).size < 70_000_000) {
  execFileSync('curl', [
    '--fail',
    '--location',
    '--retry', '3',
    '--retry-delay', '2',
    '--output', whisperModel,
    whisperModelUrl,
  ], { stdio: 'inherit' });
}
if (
  !existsSync(whisperModel)
  || statSync(whisperModel).size < 70_000_000
  || sha1(whisperModel) !== whisperModelSha1
) {
  throw new Error('ATLAS Render whisper tiny model verification failed');
}

console.log('ATLAS Render local AI + zero-cost diarization artifacts ready');
