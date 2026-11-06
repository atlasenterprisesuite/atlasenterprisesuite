/** Private stdin/stdout IPC for the native notes application. No listening port or network. */
import { createContinuity } from '../local-agent/lib/local-core-continuity.mjs';
try {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 16384) throw new Error('native_request_too_large');
  }
  const request = JSON.parse(raw);
  if (!request || !['load', 'save'].includes(request.action)) throw new Error('native_invalid_action');
  const core = createContinuity({ directory: process.argv[2], passphrase: request.passphrase, tenant: 'local-device' });
  const record = request.record === undefined ? 'notes' : request.record;
  if (request.action === 'save') await core.edit(record, request.value);
  const value = await core.read(record);
  process.stdout.write(JSON.stringify({ ok: true, value: value ?? '', status: await core.status(), records: await core.list() }));
} catch (error) {
  const known = /^(vault_|continuity_|native_)[a-z0-9_]+$/;
  process.stdout.write(JSON.stringify({ ok: false, error: known.test(error.message) ? error.message : 'native_request_failed' }));
  process.exitCode = 1;
}
