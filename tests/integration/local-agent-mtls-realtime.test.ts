import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const worker = readFileSync('worker/index.ts','utf8');
const wrangler = readFileSync('wrangler.jsonc','utf8');
const edge = readFileSync('supabase/functions/atlas-local-control/index.ts','utf8');
const migration = readFileSync('supabase/migrations/20260918234500_atlas_local_agent_mtls_realtime.sql','utf8');
const agent = readFileSync('tools/local-agent/atlas-local-agent.mjs','utf8');
const state = readFileSync('tools/local-agent/lib/secure-state.mjs','utf8');
const realtime = readFileSync('tools/local-agent/lib/realtime-client.mjs','utf8');
const linux = readFileSync('tools/local-agent/install-linux.sh','utf8');
const mac = readFileSync('tools/local-agent/install-macos.sh','utf8');
const windows = readFileSync('tools/local-agent/install-windows.ps1','utf8');
const workflow = readFileSync('.github/workflows/local-agent-mtls.yml','utf8');

describe('ATLAS Local Agent mTLS + realtime contract', () => {
  it('stores only public certificate metadata in the control plane', () => {
    for (const field of [
      'mtls_status','mtls_cert_fingerprint_sha256','mtls_cert_serial',
      'mtls_cloudflare_cert_id','mtls_cert_expires_at','realtime_last_connected_at'
    ]) expect(migration).toContain(field);
    expect(migration).not.toMatch(/add column[^;]*(private[_ ]?key|key_pem|pkcs12)/i);
  });

  it('requires Cloudflare-verified mTLS and existing agent session before websocket upgrade', () => {
    expect(worker).toContain("tls.certVerified !== 'SUCCESS'");
    expect(worker).toContain("tls.certRevoked === '1'");
    expect(worker).toContain('certFingerprintSHA256');
    expect(worker).toContain('certSerial');
    expect(worker).toContain("request.headers.get('x-atlas-agent-token')");
    expect(worker).toContain("operation: 'agent.bus.verify'");
    expect(edge).toContain("operation === 'agent.bus.verify'");
    expect(edge).toContain('mtls_fingerprint_mismatch');
    expect(edge).toContain('mtls_serial_mismatch');
    expect(edge).toContain('mtls_certificate_expired');
  });

  it('uses a hibernatable Durable Object bus and reference-only command ready events', () => {
    expect(wrangler).toContain('"LOCAL_REALTIME_BUS"');
    expect(wrangler).toContain('"AtlasLocalRealtimeBus"');
    expect(wrangler).toContain('"storage": "sqlite"');
    expect(worker).toContain('state.acceptWebSocket');
    expect(worker).toContain("event: 'command.ready'");
    expect(worker).toContain('command_id');
    expect(worker).not.toContain('command_payload');
    expect(worker).not.toContain('action_payload');
  });

  it('keeps ATLAS command authorization in the canonical control plane', () => {
    expect(edge).toContain("operation === 'bus.publish.authorize'");
    expect(edge).toContain('device.agent.use');
    expect(edge).toContain('bus_target_mismatch');
    expect(edge).toContain("['queued','claimed']");
  });

  it('uses mTLS realtime first and polling only as fallback', () => {
    expect(agent).toContain('connectMtlsWebSocket');
    expect(agent).toContain('command.realtime');
    expect(agent).toContain('FALLBACK_POLL_MS = 30_000');
    expect(agent).toContain('if (!realtimeConnected)');
    expect(agent).toContain("event?.event === 'command.ready'");
    expect(realtime).toContain('tls.connect');
    expect(realtime).toContain("target.protocol !== 'wss:'");
    expect(realtime).toContain("rejectUnauthorized: true");
  });

  it('persists session state securely without copying the mTLS private key into state', () => {
    expect(state).toContain("mode: 0o600");
    expect(state).toContain('ATLAS_AGENT_ENROLLMENT_CODE_FILE');
    expect(state).toContain('consumeEnrollmentFile');
    expect(agent).toContain('saveAgentState');
    expect(agent).toContain('sessionToken');
    expect(agent).not.toContain('privateKey: state');
  });

  it('provides persistent installers for Linux, macOS, and Windows', () => {
    expect(linux).toContain('systemd');
    expect(linux).toContain('rsa_keygen_bits:3072');
    expect(linux).toContain('chmod 0600');
    expect(mac).toContain('LaunchDaemons');
    expect(mac).toContain('rsa_keygen_bits:3072');
    expect(windows).toContain('Register-ScheduledTask');
    expect(windows).toContain('icacls');
    expect(windows).toContain('rsa_keygen_bits:3072');
  });

  it('keeps private keys on the agent and provisions only from a public CSR', () => {
    expect(workflow).toContain('csr_base64');
    expect(workflow).toContain('BEGIN CERTIFICATE REQUEST');
    expect(workflow).toContain('Private keys are forbidden');
    expect(workflow).toContain('/client_certificates');
    expect(workflow).toContain('/certificate_authorities/hostname_associations');
    expect(workflow).toContain('atlas-local-agent-mtls-provision');
    expect(workflow).toContain('mtls-provision-callback');
    expect(workflow).not.toContain('agent.key');
  });

  it('rolls back a newly issued certificate if ATLAS binding sync fails', () => {
    expect(workflow).toContain('Issued certificates are revoked on rollback');
    expect(workflow).toContain('-X DELETE');
    expect(edge).toContain('MTLS_PROVISION_WORKFLOW');
    expect(edge).toContain('github_oidc_scope_denied');
  });
});
