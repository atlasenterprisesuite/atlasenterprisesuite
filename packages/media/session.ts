/**
 * ATLAS Universal Media: pure, fail-closed authorization boundary.
 *
 * This module decides whether an attempted control is admissible. It does NOT
 * discover devices, authenticate actors, validate actual file licenses, stream
 * audio, or execute remote commands. Its inputs must come from trusted,
 * authenticated ATLAS Identity, Device OS and Creator boundaries.
 */

export type MediaKind = 'audio' | 'video';
export type MediaAction = 'play' | 'pause' | 'stop' | 'transfer' | 'volume';
export type MediaPermission = 'media.session.control' | 'media.session.admin';
export type MediaCapability = 'audio.playback' | 'video.playback' | 'volume.control';

export interface MediaActor {
  id: string;
  organizationId: string;
  permissions: readonly string[];
}
export interface MediaSession {
  id: string;
  organizationId: string;
  ownerId: string;
  kind: MediaKind;
  version: number;
}
export interface MediaSource {
  kind: 'local-file' | 'authorized-catalog' | 'external-provider';
  /** Affirmative, independently verified rights to use this content. */
  usageAuthorized: boolean;
  /** Affirmative rights to transmit/play on a different physical device. */
  remotePlaybackAuthorized: boolean;
}
export interface MediaTarget {
  id: string;
  organizationId: string;
  /** Reported by the trusted ATLAS Device OS registry, never by a browser claim. */
  enrolled: boolean;
  online: boolean;
  /** Explicit selection and consent for this device and session. */
  explicitlySelected: boolean;
  consentGranted: boolean;
  capabilities: readonly string[];
}
export interface MediaPolicyInput {
  organizationId: string;
  actor: MediaActor;
  session: MediaSession;
  source: MediaSource;
  target: MediaTarget | null;
  action: MediaAction;
  expectedVersion: number;
}
export type MediaPolicyCode =
  | 'allowed'
  | 'invalid_request'
  | 'tenant_mismatch'
  | 'permission_denied'
  | 'rights_unverified'
  | 'version_conflict'
  | 'device_required'
  | 'device_unavailable'
  | 'device_not_consented'
  | 'capability_unsupported';

export type MediaPolicyResult =
  | { allowed: true; code: 'allowed' }
  | { allowed: false; code: Exclude<MediaPolicyCode, 'allowed'> };

const DENY = (code: Exclude<MediaPolicyCode, 'allowed'>): MediaPolicyResult => ({ allowed: false, code });
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256 &&
  value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);

const has = (values: readonly string[], required: string): boolean =>
  Array.isArray(values) && values.includes(required);

/** No side effects. All remote commands still require a separate Device OS execution check. */
export function authorizeMediaCommand(input: MediaPolicyInput): MediaPolicyResult {
  if (!input || typeof input !== 'object') return DENY('invalid_request');
  const { organizationId, actor, session, source, target, action, expectedVersion } = input;
  if (
    !identifier(organizationId) || !actor || !session || !source ||
    !identifier(actor.id) || !identifier(actor.organizationId) ||
    !identifier(session.id) || !identifier(session.ownerId) ||
    !identifier(session.organizationId) ||
    !Number.isSafeInteger(session.version) || session.version < 0 ||
    !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
    !['audio', 'video'].includes(session.kind) ||
    !['play', 'pause', 'stop', 'transfer', 'volume'].includes(action) ||
    !['local-file', 'authorized-catalog', 'external-provider'].includes(source.kind) ||
    !Array.isArray(actor.permissions) ||
    typeof source.usageAuthorized !== 'boolean' ||
    typeof source.remotePlaybackAuthorized !== 'boolean' ||
    (target !== null && (
      typeof target !== 'object' || !target ||
      !identifier(target.id) || !identifier(target.organizationId) ||
      typeof target.enrolled !== 'boolean' || typeof target.online !== 'boolean' ||
      typeof target.explicitlySelected !== 'boolean' || typeof target.consentGranted !== 'boolean' ||
      !Array.isArray(target.capabilities)
    ))
  ) return DENY('invalid_request');

  if (
    actor.organizationId !== organizationId || session.organizationId !== organizationId ||
    (target && target.organizationId !== organizationId)
  ) return DENY('tenant_mismatch');
  if (!has(actor.permissions, 'media.session.control') ||
      (session.ownerId !== actor.id && !has(actor.permissions, 'media.session.admin'))) {
    return DENY('permission_denied');
  }
  if (session.version !== expectedVersion) return DENY('version_conflict');
  if (!source.usageAuthorized) return DENY('rights_unverified');
  if (action === 'transfer' && target === null) return DENY('device_required');
  if (target === null) return { allowed: true, code: 'allowed' };

  if (!source.remotePlaybackAuthorized) return DENY('rights_unverified');
  if (!target.enrolled || !target.online) return DENY('device_unavailable');
  if (!target.explicitlySelected || !target.consentGranted) return DENY('device_not_consented');
  const required: MediaCapability =
    action === 'volume' ? 'volume.control' :
    session.kind === 'video' ? 'video.playback' : 'audio.playback';
  if (!has(target.capabilities, required)) return DENY('capability_unsupported');
  return { allowed: true, code: 'allowed' };
}
