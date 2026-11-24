#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createPersonalVault } from './lib/personal-vault.mjs';
import { runVaultConsole } from './lib/personal-vault-console.mjs';

async function main() {
  // Never accept credentials through argv, environment, pipes or command history.
  if (process.argv.length !== 3 || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('interactive_terminal_required');
  }
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  } });
  const rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  const stop = () => { abort.abort(); rl.close(); };
  rl.on('SIGINT', stop);
  try {
    await runVaultConsole({ vault: createPersonalVault({ directory: process.argv[2] }),
      write: text => process.stdout.write(`${text}\n`),
      prompt: async (label, secret) => {
        hidden = secret;
        try {
          if (secret) process.stdout.write(label);
          return await rl.question(secret ? '' : label, { signal: abort.signal });
        } finally {
          if (secret) process.stdout.write('\n');
          hidden = false;
        }
      }
    });
  } finally { rl.close(); output.end(); }
}
main().catch(() => {
  process.stderr.write('ATLAS Vault: stopped. Use an interactive local terminal and an absolute private directory path.\n');
  process.exitCode = 1;
});
