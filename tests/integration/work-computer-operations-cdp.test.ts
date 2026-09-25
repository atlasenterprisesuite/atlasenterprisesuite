import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const localControl = readFileSync('supabase/functions/atlas-local-control/index.ts', 'utf8');
const localAgent = readFileSync('tools/local-agent/atlas-local-agent.mjs', 'utf8');
const browserCdp = readFileSync('tools/local-agent/lib/browser-cdp.mjs', 'utf8');
const page = readFileSync('apps/web/src/work/WorkComputerOperationsPage.tsx', 'utf8');

describe('ATLAS Computer Operations CDP telemetry', () => {
  it('exposes tenant-scoped device events through the existing Local Control boundary', () => {
    expect(localControl).toContain("operation === 'events.list'");
    expect(localControl).toContain("requirePermission(context, 'device.agent.read')");
    expect(localControl).toContain("from('atlas_local_device_events')");
    expect(localControl).toContain(".eq('org_id', context.orgId)");
  });

  it('uses the existing browser-cdp adapter and persists only sanitized diagnostic summaries', () => {
    expect(browserCdp).toContain("'diagnose'");
    expect(browserCdp).toContain("safeTelemetryUrl");
    expect(browserCdp).toContain("Network.responseReceived");
    expect(browserCdp).toContain("Runtime.exceptionThrown");
    expect(browserCdp).toContain("Log.entryAdded");
    expect(localAgent).toContain("browser.diagnostics.completed");
    expect(localAgent).toContain("console_error_count");
    expect(localAgent).toContain("js_exception_count");
    expect(localAgent).toContain("http_failure_count");
    expect(localAgent).toContain("network_failure_count");
  });

  it('keeps production diagnostics explicitly user-triggered and evidence-driven', () => {
    expect(page).toContain('Run CDP diagnostic');
    expect(page).toContain('Refresh telemetry');
    expect(page).toContain("action: 'diagnose'");
    expect(page).toContain("riskLevel: 'low'");
    expect(page).toContain('No authorized CDP device is currently eligible.');
    expect(page).not.toContain('CDP VERIFIED');
  });
});
