import test from 'node:test';
import assert from 'node:assert/strict';
import { collectWindowsDiagnosticSnapshot } from '../lib/windows-diagnostics.mjs';

const system = {
  uptime: () => 30.9, totalmem: () => 1000, freemem: () => 400,
  cpus: () => [{}, {}],
  hostname: () => { throw new Error('hostname must never be read'); },
  networkInterfaces: () => { throw new Error('network identifiers must never be read'); },
  userInfo: () => { throw new Error('user identity must never be read'); }
};
test('Windows diagnostics are local-only, minimal, and do not claim remote access', () => {
  const snapshot = collectWindowsDiagnosticSnapshot({ platform: 'win32', clock: () => 42, system });
  assert.deepEqual(snapshot, {
    schema_version: 'atlas.windows-diagnostics.v1', evidence_level: 'local-observed',
    captured_at_ms: 42, platform: 'win32', uptime_seconds: 30,
    total_memory_bytes: 1000, free_memory_bytes: 400, logical_cpu_count: 2,
    remote_control_supported: false, screen_capture_supported: false,
    wake_on_lan_verified: false
  });
  assert.equal(Object.isFrozen(snapshot), true);
});
test('refuses non-Windows environments', () => {
  assert.throws(() => collectWindowsDiagnosticSnapshot({ platform: 'linux', system }), /windows_platform_required/);
});
test('refuses inconsistent metrics', () => {
  assert.throws(() => collectWindowsDiagnosticSnapshot({ platform: 'win32', system: { ...system, freemem: () => 1001 } }), /invalid_system_metrics/);
});
