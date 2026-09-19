#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const isRender = process.env.RENDER === 'true';
const root = resolve('.atlas-render');
const llama = join(root, 'home', '.llama-app', 'llama');
const model = join(root, 'models', 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
const localPort = '18080';
let llamaChild = null;

if (
  isRender &&
  existsSync(llama) &&
  existsSync(model) &&
  String(process.env.ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN || '').trim()
) {
  llamaChild = spawn(llama, [
    'serve',
    '-m', model,
    '--alias', 'atlas-local-free',
    '--host', '127.0.0.1',
    '--port', localPort,
    '--no-webui',
    '-c', '512',
    '-np', '1',
    '-t', '1',
  ], {
    stdio: 'inherit',
    env: process.env,
  });
  llamaChild.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error('ATLAS Render local AI runtime exited', { code, signal });
    }
  });
}

const nodeArgs = [
  '--experimental-strip-types',
  '--experimental-loader=./apps/atlas-orchestrator/atlas-ts-loader.mjs',
  'apps/atlas-orchestrator/src/http.ts',
];
const orchestrator = spawn(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(llamaChild ? { ATLAS_LOCAL_AI_INTERNAL_URL: `http://127.0.0.1:${localPort}` } : {}),
  },
});

function shutdown(signal) {
  if (llamaChild && !llamaChild.killed) llamaChild.kill(signal);
  if (!orchestrator.killed) orchestrator.kill(signal);
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => shutdown(signal));
}

orchestrator.on('exit', (code, signal) => {
  if (llamaChild && !llamaChild.killed) llamaChild.kill('SIGTERM');
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
