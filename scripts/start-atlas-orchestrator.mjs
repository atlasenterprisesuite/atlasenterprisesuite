#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const isRender = process.env.RENDER === 'true';
const root = resolve('.atlas-render');
const runtimeDir = join(root, 'llama-b11046');
const model = join(root, 'models', 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
const localPort = '18080';
let llamaChild = null;

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

const llamaServer = findFile(runtimeDir, 'llama-server');

if (
  isRender &&
  llamaServer &&
  existsSync(model) &&
  String(process.env.ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN || '').trim()
) {
  const libraryDir = dirname(llamaServer);
  llamaChild = spawn(llamaServer, [
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
    env: {
      ...process.env,
      LD_LIBRARY_PATH: [libraryDir, process.env.LD_LIBRARY_PATH || ''].filter(Boolean).join(':'),
    },
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
