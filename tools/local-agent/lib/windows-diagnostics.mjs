// Read-only, local-only Windows diagnostic snapshot. No remote transport or command execution.
import os from 'node:os';

export function collectWindowsDiagnosticSnapshot({ platform = process.platform, clock = () => Date.now(), system = os } = {}) {
  if (platform !== 'win32') throw new Error('windows_platform_required');
  const uptimeSeconds = system.uptime();
  const totalMemoryBytes = system.totalmem();
  const freeMemoryBytes = system.freemem();
  const cpuCount = system.cpus().length;
  if (![uptimeSeconds, totalMemoryBytes, freeMemoryBytes, cpuCount].every(Number.isFinite) ||
      uptimeSeconds < 0 || totalMemoryBytes <= 0 || freeMemoryBytes < 0 ||
      freeMemoryBytes > totalMemoryBytes || cpuCount < 1) throw new Error('invalid_system_metrics');
  return Object.freeze({
    schema_version: 'atlas.windows-diagnostics.v1',
    evidence_level: 'local-observed',
    captured_at_ms: clock(),
    platform: 'win32',
    uptime_seconds: Math.floor(uptimeSeconds),
    total_memory_bytes: totalMemoryBytes,
    free_memory_bytes: freeMemoryBytes,
    logical_cpu_count: cpuCount,
    remote_control_supported: false,
    screen_capture_supported: false,
    wake_on_lan_verified: false
  });
}
