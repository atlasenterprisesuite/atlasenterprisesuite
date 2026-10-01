import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261001203000_atlas_remote_sessions.sql', 'utf8');
const edge = readFileSync('supabase/functions/atlas-local-control/index.ts', 'utf8');
const worker = readFileSync('worker/index.ts', 'utf8');
const wrangler = readFileSync('wrangler.jsonc', 'utf8');
const agent = readFileSync('tools/local-agent/atlas-local-agent.mjs', 'utf8');
const desktop = readFileSync('tools/local-agent/lib/remote-desktop-windows.mjs', 'utf8');
const relay = readFileSync('tools/local-agent/lib/remote-session-client.mjs', 'utf8');
const launcher = readFileSync('tools/local-agent/start-windows-remote.ps1', 'utf8');
const page = readFileSync('apps/web/src/modules/device-os/RemoteAssistPage.tsx', 'utf8');
const router = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');

describe('ATLAS Remote Assist attended screen-sharing contract', () => {
  it('stores only session authorization metadata and enables RLS', () => {
    expect(migration).toContain('create table if not exists public.atlas_remote_sessions');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('viewer_ticket_hash');
    expect(migration).toContain("check (mode = 'view')");
    expect(migration).not.toMatch(/screen_frame|keystroke|clipboard_content|frame_payload/i);
  });

  it('requires an active authenticated user session and one-time viewer ticket', () => {
    expect(edge).toContain("operation === 'remote.sessions.create'");
    expect(edge).toContain("operation === 'remote.sessions.viewer-ticket'");
    expect(edge).toContain("operation === 'remote.viewer.verify'");
    expect(edge).toContain('viewer_ticket_used_at');
    expect(edge).toContain("eq('requested_by', context.userId)");
    expect(edge).toContain('remote_view_only_required');
  });

  it('requires local consent and mTLS before the device joins the relay', () => {
    expect(edge).toContain("operation === 'agent.remote.consent'");
    expect(edge).toContain("operation === 'agent.remote.verify'");
    expect(edge).toContain("body.mtls_cert_verified !== true");
    expect(edge).toContain('mtls_fingerprint_mismatch');
    expect(desktop).toContain('[System.Windows.Forms.MessageBox]::Show');
    expect(desktop).toContain('remote_consent_denied');
  });

  it('keeps Remote Assist view-only and excludes input injection', () => {
    expect(desktop).toContain("'remote.desktop.stream'");
    expect(desktop).not.toContain('SendInput');
    expect(desktop).not.toContain('mouse_event');
    expect(desktop).not.toContain('keybd_event');
    expect(agent).not.toContain("'remote.input.pointer'");
    expect(agent).not.toContain("'remote.input.keyboard'");
    expect(worker).not.toContain("'remote.control'");
  });

  it('encrypts screen frames end to end and keeps the relay ephemeral', () => {
    expect(relay).toContain("name: 'ECDH'");
    expect(relay).toContain("name: 'AES-GCM'");
    expect(relay).toContain("event: 'remote.frame'");
    expect(worker).toContain('REMOTE_REALTIME_BUS');
    expect(worker).toContain('AtlasRemoteRealtimeBus');
    expect(worker).toContain('Ephemeral relay only');
    expect(worker).not.toContain('remote:frame:');
    expect(wrangler).toContain('"REMOTE_REALTIME_BUS"');
  });

  it('runs only as a visible, user-started Windows launcher for Remote Assist', () => {
    expect(launcher).toContain('runs visibly in this signed-in Windows session');
    expect(launcher).toContain('on-screen consent prompt');
    expect(launcher).toContain('Press Ctrl+C');
    expect(launcher).not.toContain('Register-ScheduledTask');
    expect(launcher).not.toContain('WindowStyle Hidden');
  });

  it('exposes a truthful authenticated Device OS UI without pretending unattended control exists', () => {
    expect(router).toContain("pathname === '/device-os/remote'");
    expect(page).toContain('Attended Windows Screen Share');
    expect(page).toContain('View-only by design');
    expect(page).toContain('does not provide unattended access');
    expect(page).toContain("capability: 'remote.session'");
    expect(page).toContain("action: 'session.request'");
    expect(page).toContain("riskLevel: 'medium'");
    expect(page).toContain("name: 'ECDH'");
    expect(page).toContain("name: 'AES-GCM'");
  });
});
