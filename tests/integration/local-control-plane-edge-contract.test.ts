import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-local-control/index.ts','utf8');
const agent = readFileSync('tools/local-agent/atlas-local-agent.mjs','utf8');
const panel = readFileSync('apps/web/src/modules/device-os/LocalControlPlanePanel.tsx','utf8');
const localAi = readFileSync('tools/local-agent/atlas-local-ai-runtime.mjs','utf8');

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
  });

  it('rejects secret-shaped telemetry and arbitrary command payloads', () => {
    expect(edge).toContain('sensitive_event_detail_rejected');
    expect(edge).toContain('sensitive_device_metadata_rejected');
    expect(edge).not.toContain('command_payload');
  });

  it('provides an explicit non-scanning local agent with a real HTTP health adapter', () => {
    expect(agent).toContain('readExplicitDevices');
    expect(agent).toContain("device.adapter !== 'http-health'");
    expect(agent).toContain("command.capability !== 'health.check'");
    expect(agent).toContain("command.action !== 'status.read'");
    expect(agent).not.toMatch(/\bnmap\b|\barp\s+-/i);
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
