#!/usr/bin/env node
/** Console interface for ATLAS Local Core on Windows / Linux, using the existing llama-server. */
import { generateLocalCompletion, MAX_PROMPT_CHARS } from './lib/local-core-client.mjs';

async function main() {
  if (process.stdin.isTTY) throw new Error('local_core_pipe_prompt_via_stdin');
  let prompt = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    prompt += chunk;
    if (prompt.length > MAX_PROMPT_CHARS) throw new Error('local_core_invalid_prompt');
  }
  const answer = await generateLocalCompletion({
    prompt,
    endpoint: process.env.ATLAS_LOCAL_AI_URL || 'http://127.0.0.1:8080',
    token: process.env.ATLAS_LOCAL_AI_TOKEN,
    model: process.env.ATLAS_LOCAL_AI_MODEL_ALIAS || 'atlas-local-default'
  });
  process.stdout.write(`${answer}\n`);
}

main().catch((error) => {
  process.stderr.write(`ATLAS Local Core: ${error?.message || 'local_core_error'}\n`);
  process.exitCode = 1;
});
