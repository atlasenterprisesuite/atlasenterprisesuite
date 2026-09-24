import type { AtlasAuditEvent } from '../../core/src';
import type { VoiceProfile } from './types';

export type RecordingSession = {
  id: string;
  profileId: string;
  ownerActorId: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
};

export type VoiceSample = {
  id: string;
  profileId: string;
  sessionId: string;
  encryptedAudioRef: string;
  qualityStatus: 'accepted' | 'needs_retry' | 'rejected' | 'missing';
  createdAt: string;
};

export type VoiceConsent = {
  profileId: string;
  ownerActorId: string;
  consentVersion: string;
  acceptedAt: string;
  challengeVerified: boolean;
};

export type VoicePermissionGrant = {
  profileId: string;
  granteeActorId: string;
  consumerId: string;
  grantedAt: string;
};

export interface VoiceRepository {
  getProfile(id: string): Promise<VoiceProfile | null>;
  saveProfile(profile: VoiceProfile): Promise<void>;
  listProfilesForOwner(ownerActorId: string): Promise<VoiceProfile[]>;
  saveSession(session: RecordingSession): Promise<void>;
  saveSample(sample: VoiceSample): Promise<void>;
  deleteSamplesForProfile(profileId: string): Promise<void>;
  listSamplesForProfile(profileId: string): Promise<VoiceSample[]>;
  saveConsent(consent: VoiceConsent): Promise<void>;
  replacePermissionGrants(
    profileId: string,
    grants: VoicePermissionGrant[]
  ): Promise<void>;
  listPermissionGrants(profileId: string): Promise<VoicePermissionGrant[]>;
  appendAudit(event: AtlasAuditEvent): Promise<void>;
  listAuditEvents(): Promise<AtlasAuditEvent[]>;
}

export class InMemoryVoiceRepository implements VoiceRepository {
  private readonly profiles = new Map<string, VoiceProfile>();
  private readonly sessions = new Map<string, RecordingSession>();
  private readonly samples = new Map<string, VoiceSample>();
  private readonly consents = new Map<string, VoiceConsent>();
  private readonly grants = new Map<string, VoicePermissionGrant[]>();
  private readonly audits: AtlasAuditEvent[] = [];

  async getProfile(id: string) {
    return this.profiles.get(id) ?? null;
  }

  async saveProfile(profile: VoiceProfile) {
    this.profiles.set(profile.id, {
      ...profile,
      capabilities: { ...profile.capabilities }
    });
  }

  async listProfilesForOwner(ownerActorId: string) {
    return [...this.profiles.values()].filter(
      (profile) => profile.ownerActorId === ownerActorId
    );
  }

  async saveSession(session: RecordingSession) {
    this.sessions.set(session.id, { ...session });
  }

  async saveSample(sample: VoiceSample) {
    this.samples.set(sample.id, { ...sample });
  }

  async deleteSamplesForProfile(profileId: string) {
    for (const [id, sample] of this.samples) {
      if (sample.profileId === profileId) this.samples.delete(id);
    }
  }

  async listSamplesForProfile(profileId: string) {
    return [...this.samples.values()].filter(
      (sample) => sample.profileId === profileId
    );
  }

  async saveConsent(consent: VoiceConsent) {
    this.consents.set(consent.profileId, { ...consent });
  }

  async replacePermissionGrants(
    profileId: string,
    grants: VoicePermissionGrant[]
  ) {
    this.grants.set(
      profileId,
      grants.map((grant) => ({ ...grant }))
    );
  }

  async listPermissionGrants(profileId: string) {
    return (this.grants.get(profileId) ?? []).map((grant) => ({ ...grant }));
  }

  async appendAudit(event: AtlasAuditEvent) {
    this.audits.push(event);
  }

  async listAuditEvents() {
    return [...this.audits];
  }
}
