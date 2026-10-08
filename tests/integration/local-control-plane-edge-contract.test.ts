import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-local-control/index.ts','utf8');
const agent = readFileSync('tools/local-agent/atlas-local-agent.mjs','utf8');
const panel = readFileSync('apps/web/src/modules/device-os/LocalControlPlanePanel.tsx','utf8');
const localAi = readFileSync('tools/local-agent/atlas-local-ai-runtime.mjs','utf8');
const deviceDna = readFileSync('tools/local-agent/lib/device-dna-linux.mjs','utf8');
const windowsDeviceDna = readFileSync('tools/local-agent/lib/device-dna-windows.mjs','utf8');
const deviceDnaPanel = readFileSync('apps/web/src/modules/device-os/DeviceDnaEvidencePanel.tsx','utf8');

describe('ATLAS Local Control Plane runtime contract', () => {
  it('uses one-time enrollment and short-lived hash-backed sessions', () => {
    expect(edge).toContain("operation === 'agent.enroll'");
    expect(edge).toContain('sha256(code)');
    expect(edge).toContain('SESSION_MINUTES = 60');
    expect(edge).toContain('ROTATE_BEFORE_MINUTES = 15');
    expect(edge).not.toContain('delete process.env');
  });

  it('fails closed for high-risk commands without canonical approval', () => {
    expect(edge).toContain("['high', 'critical'].includes(risk)");
    expect(edge).toContain('approved_execution_approval_required');
    expect(edge).toContain("String(step.module) !== 'device-os'");
    expect(edge).toContain("String(step.action_type) !== 'local_device_command'");
    expect(edge).toContain('digestApprovalPayload');
    expect(edge).toContain("String(approval.required_permission) !== 'execution.approve'");
    expect(edge).toContain("!['high', 'critical'].includes(String(approval.risk_level))");
    expect(edge).toContain('oauth_consent_high_risk_required');
    expect(edge).toContain("capability === 'browser.control' && action === 'oauth_consent'");
  });

  it('rejects secret-shaped telemetry and permits only bounded non-secret action payloads', () => {
    expect(edge).toContain('sensitive_event_detail_rejected');
    expect(edge).toContain('sensitive_device_metadata_rejected');
    expect(edge).toContain('safeActionPayload');
    expect(edge).toContain('sensitive_command_payload_rejected');
    expect(edge).toContain('command_payload_too_large');
    expect(edge).toContain('action_payload');
  });

  it('provides an explicit non-scanning local agent with a real HTTP health adapter', () => {
    expect(agent).toContain('readExplicitDevices');
    expect(agent).toContain("device.adapter !== 'http-health'");
    expect(agent).toContain("command.capability !== 'health.check'");
    expect(agent).toContain("command.action !== 'status.read'");
    expect(agent).not.toMatch(/\bnmap\b|\barp\s+-/i);
    expect(agent).toContain("command.capability === 'browser.control'");
  });


  it('keeps Device DNA read-only, privacy-bounded and evidence-backed', () => {
    expect(agent).toContain("device.adapter.startsWith('device-dna-')");
    expect(agent).toContain("command.capability === 'device.dna.read'");
    expect(agent).toContain("command.action === 'report.read'");
    expect(deviceDna).toContain("schema_version: 'atlas.device-dna.v1'");
    expect(deviceDna).toContain("evidence_level: 'agent-observed'");
    expect(deviceDna).toContain('hardware_attested: false');
    expect(deviceDna).toContain("'/sys/block'");
    expect(deviceDna).not.toMatch(/\bexecFile\b|\bspawn\b|\bsudo\b|\bdmidecode\b|\bsmartctl\b/);
    expect(windowsDeviceDna).toContain("adapter: 'device-dna-windows'");
    expect(windowsDeviceDna).toContain("platform: 'win32'");
    expect(windowsDeviceDna).toContain("secure_boot: 'unknown'");
    expect(windowsDeviceDna).toContain('hardware_attested: false');
    expect(windowsDeviceDna).not.toMatch(/\bexecFile\b|\bspawn\b|\bpowershell\b|\bwmic\b|\bGet-CimInstance\b/i);
    expect(deviceDnaPanel).toContain('listLocalDevices');
    expect(deviceDnaPanel).toContain("capability: 'device.dna.read'");
    expect(deviceDnaPanel).toContain("action: 'report.read'");
    expect(deviceDnaPanel).toContain('not hardware attestation');
    expect(edge).toContain('device_dna_digest_mismatch');
    expect(edge).toContain('device_dna_hardware_attestation_not_supported');
    expect(edge).toContain('device_dna_identity_metadata_rejected');
    expect(edge).toContain("adapter === 'device-dna-linux'");
    expect(edge).toContain("adapter === 'device-dna-windows'");
    expect(edge).toContain("adapter.startsWith('device-dna-')");
    expect(edge).toContain("deviceType !== 'computer'");
  });

  it('keeps the local AI runtime loopback-bound with environment-backed authentication', () => {
    expect(localAi).toContain('ATLAS_LOCAL_AI_TOKEN');
    expect(localAi).toContain('LLAMA_API_KEY:token');
    expect(localAi).toContain("ATLAS_LOCAL_AI_HOST||'127.0.0.1'");
    expect(localAi).not.toContain("'0.0.0.0'");
    expect(localAi).not.toContain("'--api-key'");
  });

  it('surfaces enrollment, agents, devices and commands in Device OS', () => {
    expect(panel).toContain('Create one-time enrollment');
    expect(panel).toContain('Registered agents');
    expect(panel).toContain('Devices');
    expect(panel).toContain('Recent commands');
    expect(panel).toContain('High/critical actions remain bound to ATLAS Approval Center');
  });
});
