import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveLocalRuntimeConfiguration } from '../lib/local-core-runtime-policy.mjs';

const local = {
  ATLAS_LOCAL_AI_TOKEN: 'a-private-test-token',
  ATLAS_LOCAL_AI_MODEL_FILE: 'C:/atlas/models/local.gguf',
  ATLAS_LOCAL_AI_OFFLINE: 'true'
};

test('sovereign mode chooses only a local model and loopback binding', () => {
  const config = resolveLocalRuntimeConfiguration(local);
  assert.deepEqual(config.args.slice(0, 4), ['--host', '127.0.0.1', '--port', '8080']);
  assert.ok(config.args.includes('-m'));
  assert.ok(!config.args.includes('-hf'));
  assert.equal(config.offline, true);
});

test('rejects public, LAN, deceptive and hostname-based bindings', () => {
  for (const host of ['0.0.0.0', '192.168.1.10', 'localhost', '127.0.0.1.evil.test', '::']) {
    assert.throws(() => resolveLocalRuntimeConfiguration({ ...local, ATLAS_LOCAL_AI_HOST: host }), /loopback_required/);
  }
  assert.equal(resolveLocalRuntimeConfiguration({ ...local, ATLAS_LOCAL_AI_HOST: '::1' }).args[1], '::1');
});

test('offline mode never selects an automatic model download', () => {
  assert.throws(() => resolveLocalRuntimeConfiguration({ ...local, ATLAS_LOCAL_AI_MODEL_FILE: '' }), /offline_model_file_required/);
  assert.throws(() => resolveLocalRuntimeConfiguration({ ...local, ATLAS_LOCAL_AI_HF_REPO: 'sample/model' }), /offline_model_file_required/);
  const compatibility = resolveLocalRuntimeConfiguration({ ATLAS_LOCAL_AI_TOKEN: 'local-test', ATLAS_LOCAL_AI_HF_REPO: 'sample/model' });
  assert.ok(compatibility.args.includes('-hf'));
});

test('rejects missing credentials, invalid ports, contexts and aliases before launch', () => {
  for (const override of [
    { ATLAS_LOCAL_AI_TOKEN: '' }, { ATLAS_LOCAL_AI_PORT: '0' }, { ATLAS_LOCAL_AI_PORT: '65536' },
    { ATLAS_LOCAL_AI_PORT: '8080 --host 0.0.0.0' }, { ATLAS_LOCAL_AI_CONTEXT: '0' },
    { ATLAS_LOCAL_AI_CONTEXT: '999999999' }, { ATLAS_LOCAL_AI_MODEL_ALIAS: 'bad model' },
    { ATLAS_LOCAL_AI_GPU_LAYERS: '1;exit' }
  ]) assert.throws(() => resolveLocalRuntimeConfiguration({ ...local, ...override }));
});

test('direct runtime fails before starting an externally bound server', () => {
  const runtime = fileURLToPath(new URL('../atlas-local-ai-runtime.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [runtime], {
    env: { ...local, ATLAS_LOCAL_AI_HOST: '0.0.0.0' },
    encoding: 'utf8', timeout: 5000
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local_core_runtime_loopback_required/);
});

test('personal launcher forces offline mode and installers package the policy', () => {
  const source = fileURLToPath(new URL('../atlas-local-core-device.mjs', import.meta.url));
  const cli = readFileSync(source, 'utf8');
  assert.match(cli, /process\.env\.ATLAS_LOCAL_AI_OFFLINE = 'true'/);
  for (const installer of ['../install-local-core-windows.ps1', '../install-local-core-ubuntu.sh']) {
    assert.match(readFileSync(new URL(installer, import.meta.url), 'utf8'), /local-core-runtime-policy\.mjs/);
  }
  const result = spawnSync(process.execPath, [source, 'runtime'], {
    env: { ...local, ATLAS_LOCAL_AI_MODEL_FILE: '', ATLAS_LOCAL_AI_HF_REPO: 'sample/model' },
    encoding: 'utf8', timeout: 5000
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local_core_offline_model_file_required/);
});
