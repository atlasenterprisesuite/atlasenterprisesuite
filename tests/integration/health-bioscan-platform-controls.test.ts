import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-platform-controls/index.ts', 'utf8');
const bioscan = readFileSync('supabase/functions/atlas-platform-controls/bioscan.ts', 'utf8');
const surface = `${edge}\n${bioscan}`;
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
    expect(edge).toContain('handleBioScan(req, api');
    expect(edge).toContain('auth.getUser(token)');
    expect(bioscan).toContain("req.headers.get('x-atlas-org-id')");
    expect(bioscan).toContain(".from('organization_members')");
    expect(bioscan).toContain(".eq('status', 'active')");
  });

  it('exposes only the approved Phase-1 operation family', () => {
    for (const operation of OPERATIONS) expect(surface).toContain(operation);
    expect(surface).not.toContain('bioscan-v1-measurement-create');
    expect(surface).not.toContain('bioscan-v1-posture-create');
    expect(surface).not.toContain('bioscan-v1-sensor-attach');
  });

  it('enforces subject scope and separates capture/read/manage permissions', () => {
    expect(bioscan).toContain("bioscanPermission(ctx, 'health.bioscan.capture', deps)");
    expect(bioscan).toContain("bioscanPermission(ctx, 'health.bioscan.read', deps)");
    expect(bioscan).toContain("'health.bioscan.manage'");
    expect(bioscan).toContain('subject_user_id');
    expect(bioscan).toContain('cross_subject_permission_required');
  });

  it('rechecks body-scan consent before active and terminal capture transitions', () => {
    expect(bioscan).toContain(".from('bioscan_consents')");
    expect(bioscan).toContain(".eq('scope', 'body_scan')");
    expect(bioscan).toContain(".eq('status', 'granted')");
    expect(bioscan).toContain("['capturing','processing','complete','partial']");
    expect(bioscan).toContain('bioscan_active_consent_required');
  });

  it('implements forward-only transitions and idempotent same-state retries', () => {
    expect(bioscan).toContain('BIOSCAN_TRANSITIONS');
    expect(bioscan).toContain('if (current.status === target)');
    expect(bioscan).toContain('idempotent: true');
    expect(bioscan).toContain('bioscan_invalid_transition');
  });

  it('creates at most one canonical snapshot per session or idempotency key', () => {
    expect(bioscan).toContain(".from('human_twin_snapshots')");
    expect(bioscan).toContain("['complete','partial'].includes(session.status)");
    expect(bioscan).toContain('idempotency_key');
    expect(bioscan).toContain('bioscan_snapshot_session_not_final');
  });

  it('rejects raw capture payloads instead of persisting them', () => {
    expect(bioscan).toContain('bioscanRejectRawCapturePayload');
    expect(bioscan).toMatch(/raw[_-]?frame|base64|data:image|video\/|image\//i);
    expect(bioscan).toContain('raw_capture_payload_rejected');
    expect(bioscan).toContain('raw_frame_persistence: false');
  });

  it('uses transactional service-side subject erasure and preserves only minimal audit evidence', () => {
    expect(bioscan).toContain(".rpc('atlas_bioscan_delete_subject_data'");
    expect(bioscan).toContain("'bioscan.data.deleted'");
    expect(bioscan).toContain('deleted_counts');
    expect(surface).not.toContain('bioscan_tombstone');
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
    ]) expect(bioscan).toContain(event);
    expect(surface).not.toContain('bioscan.measurement.viewed');
    expect(surface).not.toContain('bioscan.sensor.connected');
  });
});