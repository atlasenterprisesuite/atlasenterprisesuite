#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

if (process.env.RENDER !== 'true') process.exit(0);

const root = resolve('.atlas-render');
const home = join(root, 'home');
const modelDir = join(root, 'models');
const llama = join(home, '.llama-app', 'llama');
const model = join(modelDir, 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
const modelUrl = 'https://huggingface.co/QuantFactory/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct.Q4_K_M.gguf?download=true';

mkdirSync(home, { recursive: true });
mkdirSync(modelDir, { recursive: true });

const env = {
  ...process.env,
  HOME: home,
  LLAMA_VERSION: 'v0.4.1',
  SKIP_CUDA: '1',
  SKIP_ROCM: '1',
  SKIP_VULKAN: '1',
};

if (!existsSync(llama)) {
  execFileSync('sh', ['-c', 'curl -LsSf https://llama.app/install.sh | sh'], {
    stdio: 'inherit',
    env,
  });
}
if (!existsSync(llama)) throw new Error('ATLAS Render llama runtime installation failed');

if (!existsSync(model) || statSync(model).size < 90_000_000) {
  execFileSync('curl', [
    '--fail',
    '--location',
    '--retry', '3',
    '--retry-delay', '2',
    '--output', model,
    modelUrl,
  ], { stdio: 'inherit', env });
}
if (!existsSync(model) || statSync(model).size < 90_000_000) {
  throw new Error('ATLAS Render GGUF model download failed');
}

console.log('ATLAS Render local AI artifact ready');
