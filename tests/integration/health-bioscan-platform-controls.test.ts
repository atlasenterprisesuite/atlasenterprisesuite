import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-platform-controls/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

const OPERATIONS = [
  'bioscan-v1-capabilities',
  'bioscan-v1-consent-grant',
  'bioscan-v1-consent-revoke',
  'bioscan-v1-session-create',
  'bioscan-v1-session-transition',
  'bioscan-v1-snapshot-create',
  'bioscan-v1-snapshot-read',
  'bioscan-v1-timeline',
  'bioscan-v1-export',
  'bioscan-v1-delete-subject'
] as const;

describe('ATLAS BioScan governed control plane', () => {
  it('keeps BioScan behind the existing JWT-protected platform control plane', () => {
    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toContain('verify_jwt = true');
    expect(edge).toContain("(api || '').startsWith('bioscan-v1-')");
    expect(edge).toContain('auth.getUser(token)');
    expect(edge).toContain("req.headers.get('x-atlas-org-id')");
    expect(edge).toContain(".from('organization_members')");
    expect(edge).toContain(".eq('status', 'active')");
  });

  it('exposes only the approved Phase-1 operation family', () => {
    for (const operation of OPERATIONS) expect(edge).toContain(operation);
    expect(edge).not.toContain('bioscan-v1-measurement-create');
    expect(edge).not.toContain('bioscan-v1-posture-create');
    expect(edge).not.toContain('bioscan-v1-sensor-attach');
  });

  it('enforces subject scope and separates capture/read/manage permissions', () => {
    expect(edge).toContain("bioscanPermission(ctx, 'health.bioscan.capture')");
    expect(edge).toContain("bioscanPermission(ctx, 'health.bioscan.read')");
    expect(edge).toContain("bioscanPermission(ctx, 'health.bioscan.manage')");
    expect(edge).toContain('subject_user_id');
    expect(edge).toContain('cross_subject_permission_required');
  });

  it('rechecks body-scan consent before active and terminal capture transitions', () => {
    expect(edge).toContain(".from('bioscan_consents')");
    expect(edge).toContain(".eq('scope', 'body_scan')");
    expect(edge).toContain(".eq('status', 'granted')");
    expect(edge).toContain("['capturing','processing','complete','partial']");
    expect(edge).toContain('bioscan_active_consent_required');
  });

  it('implements forward-only transitions and idempotent same-state retries', () => {
    expect(edge).toContain('BIOSCAN_TRANSITIONS');
    expect(edge).toContain('if (current.status === target)');
    expect(edge).toContain('idempotent: true');
    expect(edge).toContain('bioscan_invalid_transition');
  });

  it('creates at most one canonical snapshot per session or idempotency key', () => {
    expect(edge).toContain(".from('human_twin_snapshots')");
    expect(edge).toContain("['complete','partial'].includes(session.status)");
    expect(edge).toContain('idempotency_key');
    expect(edge).toContain('bioscan_snapshot_session_not_final');
  });

  it('rejects raw capture payloads and secret-like material', () => {
    expect(edge).toContain('bioscanRejectRawCapturePayload');
    expect(edge).toMatch(/raw[_-]?frame|base64|data:image|video\/|image\//i);
    expect(edge).toContain('raw_capture_payload_rejected');
  });

  it('uses transactional service-side subject erasure and preserves only minimal audit evidence', () => {
    expect(edge).toContain(".rpc('atlas_bioscan_delete_subject_data'");
    expect(edge).toContain("'bioscan.data.deleted'");
    expect(edge).toContain('deleted_counts');
    expect(edge).not.toContain('bioscan_tombstone');
  });

  it('emits the approved audit event family without fabricating later-phase events', () => {
    for (const event of [
      'bioscan.consent.granted',
      'bioscan.consent.revoked',
      'bioscan.session.started',
      'bioscan.session.completed',
      'bioscan.session.failed',
      'bioscan.snapshot.created',
      'bioscan.snapshot.viewed',
      'bioscan.data.exported',
      'bioscan.data.deleted'
    ]) expect(edge).toContain(event);
    expect(edge).not.toContain('bioscan.measurement.viewed');
    expect(edge).not.toContain('bioscan.sensor.connected');
  });
});
