import { describe, expect, it } from 'vitest';
import { authorizeMediaCommand, type MediaPolicyInput } from '../../packages/media/session';

const base = (): MediaPolicyInput => ({
  organizationId: 'tenant-a',
  actor: { id: 'owner', organizationId: 'tenant-a', permissions: ['media.session.control'] },
  session: { id: 'session-1', organizationId: 'tenant-a', ownerId: 'owner', kind: 'audio', version: 3 },
  source: { kind: 'local-file', usageAuthorized: true, remotePlaybackAuthorized: false },
  target: null,
  action: 'play',
  expectedVersion: 3
});

describe('ATLAS Universal Media policy / fail-closed contract', () => {
  it('allows owner-controlled, authorized playback in the current local browser', () => {
    expect(authorizeMediaCommand(base())).toEqual({ allowed: true, code: 'allowed' });
  });

  it('rejects cross-tenant actor and cross-tenant session', () => {
    expect(authorizeMediaCommand({ ...base(), actor: { ...base().actor, organizationId: 'tenant-b' } }).code).toBe('tenant_mismatch');
    expect(authorizeMediaCommand({ ...base(), session: { ...base().session, organizationId: 'tenant-b' } }).code).toBe('tenant_mismatch');
  });

  it('rejects missing permission and another user without delegated admin rights', () => {
    expect(authorizeMediaCommand({ ...base(), actor: { ...base().actor, permissions: [] } }).code).toBe('permission_denied');
    expect(authorizeMediaCommand({ ...base(), actor: { ...base().actor, id: 'stranger' } }).code).toBe('permission_denied');
  });

  it('fails closed on unknown usage rights, stale sessions, and invalid requests', () => {
    expect(authorizeMediaCommand({ ...base(), source: { ...base().source, usageAuthorized: false } }).code).toBe('rights_unverified');
    expect(authorizeMediaCommand({ ...base(), expectedVersion: 2 }).code).toBe('version_conflict');
    expect(authorizeMediaCommand({ ...base(), session: { ...base().session, id: '' } }).code).toBe('invalid_request');
  });

  it('requires an explicitly enrolled, online, consented remote device', () => {
    const target = { id: 'laptop-1', organizationId: 'tenant-a', enrolled: true, online: true, explicitlySelected: true, consentGranted: true, capabilities: ['audio.playback', 'volume.control'] as const };
    expect(authorizeMediaCommand({ ...base(), action: 'transfer', target }).code).toBe('rights_unverified');
    const remote = { ...base(), action: 'transfer' as const, source: { ...base().source, remotePlaybackAuthorized: true }, target };
    expect(authorizeMediaCommand(remote).code).toBe('allowed');
    expect(authorizeMediaCommand({ ...remote, target: { ...target, enrolled: false } }).code).toBe('device_unavailable');
    expect(authorizeMediaCommand({ ...remote, target: { ...target, online: false } }).code).toBe('device_unavailable');
    expect(authorizeMediaCommand({ ...remote, target: { ...target, explicitlySelected: false } }).code).toBe('device_not_consented');
    expect(authorizeMediaCommand({ ...remote, target: { ...target, consentGranted: false } }).code).toBe('device_not_consented');
    expect(authorizeMediaCommand({ ...remote, target: { ...target, organizationId: 'tenant-b' } }).code).toBe('tenant_mismatch');
  });

  it('blocks transferring without a target, unsupported video, and absent remote permissions', () => {
    expect(authorizeMediaCommand({ ...base(), action: 'transfer' }).code).toBe('device_required');
    const target = { id: 'laptop-1', organizationId: 'tenant-a', enrolled: true, online: true, explicitlySelected: true, consentGranted: true, capabilities: ['audio.playback'] as const };
    expect(authorizeMediaCommand({ ...base(), session: { ...base().session, kind: 'video' }, target }).code).toBe('capability_unsupported');
    expect(authorizeMediaCommand({ ...base(), target }).code).toBe('rights_unverified');
  });

  it('allows delegated admins but never skips the explicit control permission', () => {
    const actor = { id: 'admin', organizationId: 'tenant-a', permissions: ['media.session.admin', 'media.session.control'] };
    expect(authorizeMediaCommand({ ...base(), actor }).code).toBe('allowed');
    expect(authorizeMediaCommand({ ...base(), actor: { ...actor, permissions: ['media.session.admin'] } }).code).toBe('permission_denied');
  });
});
