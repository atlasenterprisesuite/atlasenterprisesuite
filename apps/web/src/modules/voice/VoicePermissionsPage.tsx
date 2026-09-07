import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteVoice,
  InMemoryVoiceRepository,
  providerSupports,
  type VoiceConsumer,
  type VoiceProfile
} from '../../../../../packages/voice/src';
import './voice.css';

const draftProfile: VoiceProfile = {
  id: 'personal-voice-draft',
  ownerActorId: 'demo-user',
  tenantId: 'tenant-demo',
  organizationId: 'org-demo',
  name: 'Personal Voice draft',
  language: 'en-US',
  providerKind: 'atlas',
  status: 'draft',
  capabilities: {
    localPlayback: false,
    audioExport: false,
    realtimeStream: false,
    telephony: false,
    serverSynthesis: false
  },
  createdAt: '2026-09-06T00:00:00.000Z'
};

const consumers: { id: VoiceConsumer; label: string; capability: 'localPlayback' | 'realtimeStream' | 'telephony' | 'serverSynthesis' }[] = [
  { id: 'atlas_assistant', label: 'ATLAS Assistant', capability: 'localPlayback' },
  { id: 'atlas_connect', label: 'ATLAS Connect', capability: 'serverSynthesis' },
  { id: 'atlas_telecom', label: 'ATLAS Telecom', capability: 'telephony' },
  { id: 'external_stream', label: 'External realtime stream', capability: 'realtimeStream' }
];

export function VoicePermissionsPage({ profile = draftProfile }: { profile?: VoiceProfile }) {
  const [selected, setSelected] = useState<VoiceConsumer[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(profile.status === 'deleted');
  const repository = useMemo(() => new InMemoryVoiceRepository(), []);

  async function confirmDelete() {
    await repository.saveProfile(profile);
    await repository.replacePermissionGrants(profile.id, selected.map((consumer) => ({
      profileId: profile.id,
      grantedActorId: profile.ownerActorId,
      consumer,
      grantedAt: new Date().toISOString()
    })));
    await deleteVoice(repository, profile.id, profile.ownerActorId);
    setSelected([]);
    setDeleted(true);
    setConfirmingDelete(false);
  }

  if (deleted) {
    return (
      <section className="page-stack voice-page">
        <header className="page-header"><p className="eyebrow">Personal Voice</p><h1>Voice deleted</h1><p>The session grants were revoked and the voice profile was marked deleted. Audit contains metadata only.</p></header>
        <Link className="text-link" to="/voice/personal-voice">Return to Personal Voice</Link>
      </section>
    );
  }

  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">Personal Voice</p>
        <h1>Permissions</h1>
        <p>Access to ATLAS does not automatically grant permission to use a personal voice. Every consumer is capability-gated.</p>
      </header>
      <div className="notice">Development adapter: permission changes on this page apply only to this browser session until a persistent encrypted voice backend is configured.</div>
      <div className="voice-permission-list">
        {consumers.map((consumer) => {
          const supported = providerSupports(profile.capabilities, consumer.capability)
            || (consumer.id === 'atlas_assistant' && providerSupports(profile.capabilities, 'serverSynthesis'));
          return (
            <label key={consumer.id}>
              <span><strong>{consumer.label}</strong><small>Requires {consumer.capability}</small></span>
              <input
                type="checkbox"
                aria-label={consumer.label}
                disabled={!supported}
                checked={selected.includes(consumer.id)}
                onChange={(event) => setSelected((current) => event.target.checked ? [...current, consumer.id] : current.filter((item) => item !== consumer.id))}
              />
            </label>
          );
        })}
      </div>
      <div className="voice-danger-zone">
        <div><strong>Delete Voice</strong><p>Revokes grants, removes sample references, and marks this profile deleted. Audio is never copied into audit.</p></div>
        <button type="button" className="danger-action" onClick={() => setConfirmingDelete(true)}>Delete Voice</button>
      </div>
      {confirmingDelete ? (
        <div className="voice-dialog-backdrop" role="presentation">
          <div className="voice-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-voice-title">
            <h2 id="delete-voice-title">Delete this Personal Voice?</h2>
            <p>This action revokes the current grants and removes its stored sample references from the voice repository.</p>
            <div className="voice-actions">
              <button type="button" className="secondary-action" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button type="button" className="danger-action" onClick={() => void confirmDelete()}>Confirm delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
