import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-local-control/index.ts','utf8');
const agent = readFileSync('tools/local-agent/atlas-local-agent.mjs','utf8');
const panel = readFileSync('apps/web/src/modules/device-os/LocalControlPlanePanel.tsx','utf8');
const localAi = readFileSync('tools/local-agent/atlas-local-ai-runtime.mjs','utf8');
const trustMigration = readFileSync('supabase/migrations/20260920111500_device_os_trust_hardening.sql','utf8');

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

  it('keeps the local AI runtime loopback-bound with environment-backed authentication', () => {
    expect(localAi).toContain('ATLAS_LOCAL_AI_TOKEN');
    expect(localAi).toContain('LLAMA_API_KEY:token');
    expect(localAi).toContain("ATLAS_LOCAL_AI_HOST||'127.0.0.1'");
    expect(localAi).not.toContain("'0.0.0.0'");
    expect(localAi).not.toContain("'--api-key'");
  });

  it('keeps mTLS trust provider-backed and enrollment truthfully offline until heartbeat', () => {
    expect(edge).not.toContain("operation === 'agents.mtls.bind'");
    expect(edge).not.toContain("if (operation === 'agents.mtls.bind')");
    expect(edge).toContain("status: 'offline'");
    expect(edge).toContain("status: 'online', last_seen_at: now");
    expect(edge).toContain('mtls_cloudflare_cert_id: certificateId');
    expect(edge).toContain("eventType: 'agent.mtls.provider_issued'");
    expect(edge).toContain("rpc('has_identity_permission'");
    expect(trustMigration).toContain("alter column status set default 'offline'");
    expect(trustMigration).toContain("status <> 'online' or last_seen_at is not null");
    expect(trustMigration).toContain('atlas_local_agents_active_mtls_requires_provider_evidence');
    expect(trustMigration).toContain('mtls_cloudflare_cert_id is not null');
  });

  it('surfaces enrollment, agents, devices and commands in Device OS', () => {
    expect(panel).toContain('Create one-time enrollment');
    expect(panel).toContain('Registered agents');
    expect(panel).toContain('Devices');
    expect(panel).toContain('Recent commands');
    expect(panel).toContain('High/critical actions remain bound to ATLAS Approval Center');
    expect(panel).toContain('Device OS Trust Posture');
    expect(panel).not.toContain('Bind mTLS certificate');
  });
});
