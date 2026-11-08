#!/usr/bin/env node
/** ATLAS Local Core device entrypoint. No hidden cloud access. */
import { emitKeypressEvents } from 'node:readline';
import { memoryPut, memoryGet, memoryList, memoryDelete, vaultDirectory } from './lib/local-core-vault.mjs';
import { existsSync } from 'node:fs';
import { generateLocalCompletion, MAX_PROMPT_CHARS } from './lib/local-core-client.mjs';

function hidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) return reject(new Error('local_core_interactive_terminal_required'));
    process.stdout.write(prompt);
    let value = '';
    const input = process.stdin;
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    const cleanup = () => { input.off('keypress', onKey); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    const onKey = (ch, key) => {
      if (key?.ctrl && key?.name === 'c') { cleanup(); reject(new Error('local_core_cancelled')); return; }
      if (key?.name === 'return' || key?.name === 'enter') { cleanup(); resolve(value); return; }
      if (key?.name === 'backspace') { value = value.slice(0, -1); return; }
      if (ch && !key?.ctrl && !key?.meta && ch >= ' ' && ch !== '\u007f' && Buffer.byteLength(value + ch, 'utf8') <= 65536) value += ch;
    };
    input.on('keypress', onKey);
  });
}

async function run() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write('ATLAS Local Core\n  doctor\n  memory put <id>\n  memory get <id>\n  memory list\n  memory delete <id>\n  ask  (prompt piped through stdin)\n  runtime  (requires configured llama-server and GGUF)\n');
    return;
  }
  if (command === 'doctor') {
    const dir = vaultDirectory();
    const modelFile = process.env.ATLAS_LOCAL_AI_MODEL_FILE;
    const report = {
      platform: process.platform,
      node22OrNewer: Number(process.versions.node.split('.')[0]) >= 22,
      privateDirectoryInstalled: existsSync(dir),
      localModelFileAvailable: Boolean(modelFile && existsSync(modelFile)),
      localRuntimeConfigured: Boolean(process.env.ATLAS_LOCAL_AI_TOKEN && (modelFile || process.env.ATLAS_LOCAL_AI_HF_REPO)),
      remoteDeviceValidated: false
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.node22OrNewer || !report.privateDirectoryInstalled) process.exitCode = 1;
    return;
  }
  if (command === 'runtime') {
    if (process.env.ATLAS_LOCAL_AI_HOST && !['127.0.0.1', '::1', 'localhost'].includes(process.env.ATLAS_LOCAL_AI_HOST)) throw new Error('local_core_runtime_loopback_required');
    await import('./atlas-local-ai-runtime.mjs');
    return;
  }
  if (command === 'ask') {
    if (process.stdin.isTTY) throw new Error('local_core_pipe_prompt_via_stdin');
    let prompt = '';
    for await (const chunk of process.stdin) {
      prompt += chunk.toString();
      if (prompt.length > MAX_PROMPT_CHARS) throw new Error('local_core_invalid_prompt');
    }
    const answer = await generateLocalCompletion({ prompt, token: process.env.ATLAS_LOCAL_AI_TOKEN, endpoint: process.env.ATLAS_LOCAL_AI_URL || 'http://127.0.0.1:8080', model: process.env.ATLAS_LOCAL_AI_MODEL_ALIAS || 'atlas-local-default' });
    process.stdout.write(answer + '\n');
    return;
  }
  if (command !== 'memory') throw new Error('local_core_unknown_command');
  const [action, id, extra] = args;
  if (!['put', 'get', 'list', 'delete'].includes(action) || extra || (action !== 'list' && !id) || (action === 'list' && id)) throw new Error('local_core_memory_usage');
  const passphrase = await hidden('Vault passphrase (hidden): ');
  if (action === 'put') {
    const value = await hidden('Memory text (hidden): ');
    await memoryPut({ id, value, passphrase });
    process.stdout.write('Encrypted memory saved.\n');
  } else if (action === 'list') {
    const ids = await memoryList({ passphrase });
    process.stdout.write(ids.join('\n') + '\n');
  } else if (action === 'get') {
    const value = await memoryGet({ id, passphrase });
    if (value === null) throw new Error('vault_entry_not_found');
    process.stdout.write(value + '\n');
  } else {
    const deleted = await memoryDelete({ id, passphrase });
    process.stdout.write(deleted ? 'Memory entry removed from active vault. Backups may persist.\n' : 'Memory entry absent.\n');
  }
}
run().catch(err => { process.stderr.write('ATLAS Local Core: ' + (err?.message || 'operation_failed') + '\n'); process.exitCode = 1; });
