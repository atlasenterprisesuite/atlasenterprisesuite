import type {
  RecordingSession,
  VoiceAuditEvent,
  VoiceConsent,
  VoicePermissionGrant,
  VoiceProfile,
  VoiceSample
} from './types';
import { actorOwnsVoice } from './policy';

export interface VoiceRepository {
  getProfile(id: string): Promise<VoiceProfile | null>;
  saveProfile(profile: VoiceProfile): Promise<void>;
  listProfilesForOwner(ownerActorId: string): Promise<VoiceProfile[]>;
  saveSession(session: RecordingSession): Promise<void>;
  saveSample(sample: VoiceSample): Promise<void>;
  deleteSamplesForProfile(profileId: string): Promise<void>;
  saveConsent(consent: VoiceConsent): Promise<void>;
  replacePermissionGrants(profileId: string, grants: VoicePermissionGrant[]): Promise<void>;
  appendAudit(event: VoiceAuditEvent): Promise<void>;
}

export class InMemoryVoiceRepository implements VoiceRepository {
  readonly profiles = new Map<string, VoiceProfile>();
  readonly sessions = new Map<string, RecordingSession>();
  readonly samples = new Map<string, VoiceSample>();
  readonly consents = new Map<string, VoiceConsent>();
  readonly grants = new Map<string, VoicePermissionGrant[]>();
  readonly audit: VoiceAuditEvent[] = [];

  async getProfile(id: string) {
    return this.profiles.get(id) ?? null;
  }

  async saveProfile(profile: VoiceProfile) {
    this.profiles.set(profile.id, profile);
  }

  async listProfilesForOwner(ownerActorId: string) {
    return [...this.profiles.values()].filter((profile) => profile.ownerActorId === ownerActorId);
  }

  async saveSession(session: RecordingSession) {
    this.sessions.set(session.id, session);
  }

  async saveSample(sample: VoiceSample) {
    this.samples.set(sample.id, sample);
  }

  async deleteSamplesForProfile(profileId: string) {
    for (const [id, sample] of this.samples) {
      if (sample.profileId === profileId) this.samples.delete(id);
    }
  }

  async saveConsent(consent: VoiceConsent) {
    this.consents.set(consent.id, consent);
  }

  async replacePermissionGrants(profileId: string, grants: VoicePermissionGrant[]) {
    this.grants.set(profileId, [...grants]);
  }

  async appendAudit(event: VoiceAuditEvent) {
    this.audit.push(event);
  }
}

export async function deleteVoice(
  repository: VoiceRepository,
  profileId: string,
  actorId: string,
  now = new Date().toISOString()
) {
  const profile = await repository.getProfile(profileId);
  if (!profile) throw new Error('voice_not_found');
  if (!actorOwnsVoice(profile, actorId)) throw new Error('voice_owner_required');

  await repository.replacePermissionGrants(profileId, []);
  await repository.deleteSamplesForProfile(profileId);
  await repository.saveProfile({ ...profile, status: 'deleted' });
  await repository.appendAudit({
    id: `audit-${profileId}-${now}`,
    profileId,
    actorId,
    action: 'voice.deleted',
    createdAt: now,
    metadata: { providerKind: profile.providerKind }
  });
}
