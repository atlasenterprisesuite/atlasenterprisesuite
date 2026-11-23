#!/usr/bin/env node
/** Launch the existing llama.cpp server only after validating the local runtime boundary. */
import { spawn } from 'node:child_process';
import { resolveLocalRuntimeConfiguration } from './lib/local-core-runtime-policy.mjs';

const { binary, args, token } = resolveLocalRuntimeConfiguration(process.env);
const child = spawn(binary, args, {
  stdio: 'inherit',
  env: { ...process.env, LLAMA_API_KEY: token }
});
child.on('exit', (code, signal) => {
  if (signal) process.stderr.write(`ATLAS Local AI stopped by ${signal}\n`);
  process.exitCode = typeof code === 'number' ? code : 1;
});
child.on('error', (error) => {
  process.stderr.write(`ATLAS Local AI failed to start: ${error?.message || 'runtime_error'}\n`);
  process.exitCode = 1;
});
