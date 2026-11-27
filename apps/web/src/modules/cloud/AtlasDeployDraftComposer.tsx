import { useEffect, useRef, useState, type FormEvent } from 'react';
import { atlasAuthorizedJson, getActiveAtlasOrganization } from '../../lib/atlasSession';
import {
  buildAtlasSovereignReleaseDraft,
  canWriteAtlasSovereignReleaseDraft,
  type AtlasSovereignInfraSnapshot,
  type AtlasSovereignReleaseDraftInput
} from '../../../../../packages/core/src/deploymentControl';

type Props = {
  organizationId: string;
  infra: AtlasSovereignInfraSnapshot;
  now: number;
  onCreated: (id: string) => void;
};

type PermissionState = 'checking' | 'allowed' | 'denied';
const RELEASE_CONTROL = '/functions/v1/atlas-release-control?api=release-create';
const PERMISSION_CHECK = '/rest/v1/rpc/has_identity_permission';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const initialDraft = (): AtlasSovereignReleaseDraftInput => ({
  releaseKey: '',
  version: '',
  channel: 'development',
  sourceSha: '',
  artifactSha256: ''
});

/**
 * Only the creation of a pending release draft is enabled. Authorization is
 * rechecked on every submit by an active authenticated user, then checked again
 * by the existing server releases.create gate and RLS-backed RPC.
 * This component cannot freeze, promote, deploy or bypass P0.
 */
export function AtlasDeployDraftComposer({ organizationId, infra, now, onCreated }: Props) {
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [draft, setDraft] = useState<AtlasSovereignReleaseDraftInput>(initialDraft);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const scopeCurrent = canWriteAtlasSovereignReleaseDraft({
    organizationId, infra, granted: true, now
  });
  const canCreate = scopeCurrent && permission === 'allowed' && !busy;

  useEffect(() => {
    let mounted = true;
    setPermission('checking');
    if (!canWriteAtlasSovereignReleaseDraft({
      organizationId, infra, granted: true, now: Date.now()
    })) {
      setPermission('denied');
      return () => { mounted = false; };
    }
    void atlasAuthorizedJson<boolean>(PERMISSION_CHECK, {
      method: 'POST',
      headers: { 'x-atlas-org-id': organizationId },
      body: JSON.stringify({ o: organizationId, p: 'releases.create' }),
      cache: 'no-store'
    }).then(result => {
      if (mounted) setPermission(result === true ? 'allowed' : 'denied');
    }).catch(() => {
      if (mounted) setPermission('denied');
    });
    return () => { mounted = false; };
  }, [organizationId, infra]);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError('');
    setCreatedId('');

    if (!canWriteAtlasSovereignReleaseDraft({
      organizationId, infra, granted: permission === 'allowed', now: Date.now()
    })) {
      setError('write_scope_or_permission_invalid');
      return;
    }

    let payload: ReturnType<typeof buildAtlasSovereignReleaseDraft>;
    try {
      payload = buildAtlasSovereignReleaseDraft(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'invalid_release_draft');
      return;
    }

    inFlight.current = true;
    setBusy(true);
    try {
      const org = await getActiveAtlasOrganization();
      if (org.id !== organizationId) throw new Error('organization_context_changed');

      // Do not trust the privilege check performed when the page first loaded:
      // active membership and explicit overrides can be revoked at any time.
      const headers = { 'x-atlas-org-id': organizationId };
      const granted = await atlasAuthorizedJson<boolean>(PERMISSION_CHECK, {
        method: 'POST',
        headers,
        body: JSON.stringify({ o: organizationId, p: 'releases.create' }),
        cache: 'no-store'
      });
      if (granted !== true) {
        setPermission('denied');
        throw new Error('permission_denied');
      }
      if (!canWriteAtlasSovereignReleaseDraft({
        organizationId, infra, granted: true, now: Date.now()
      })) throw new Error('infrastructure_evidence_stale');

      const result = await atlasAuthorizedJson<{ ok: boolean; release_id?: string }>(
        RELEASE_CONTROL, {
          method: 'POST',
          cache: 'no-store',
          headers,
          body: JSON.stringify(payload)
        }
      );
      if (!result?.ok || !result.release_id || !UUID.test(result.release_id)) {
        throw new Error('release_draft_response_invalid');
      }
      setCreatedId(result.release_id);
      onCreated(result.release_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'release_draft_create_failed');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="atlas-cloud-toolbox" aria-labelledby="atlas-deploy-write-heading">
      <h2 id="atlas-deploy-write-heading">Controlled write access · Release drafts</h2>
      <p>Only a new, unapproved release draft can be created here. The existing backend checks the authenticated organization's releases.create permission and records the requester. No deployment, release promotion, provider purchase or production change is triggered.</p>

      {!scopeCurrent ? (
        <p role="status">Scope or evidence is not current. Synchronize ATLAS Manager before requesting write access.</p>
      ) : permission === 'checking' ? (
        <p role="status">Checking organization write authorization…</p>
      ) : permission !== 'allowed' ? (
        <p role="status">Read-only: releases.create permission is not granted for this organization.</p>
      ) : (
        <form onSubmit={event => void createDraft(event)} aria-label="Create a controlled release draft">
          <div className="atlas-cloud-toolbar">
            <label>
              <span>Release key</span>
              <input value={draft.releaseKey} maxLength={160} autoComplete="off"
                onChange={event => setDraft(previous => ({ ...previous, releaseKey: event.target.value }))}
                placeholder="atlas-web-2026-11-rc1" required />
            </label>
            <label>
              <span>Version</span>
              <input value={draft.version} maxLength={100} autoComplete="off"
                onChange={event => setDraft(previous => ({ ...previous, version: event.target.value }))}
                placeholder="2026.11.26-rc1" required />
            </label>
            <label>
              <span>Release channel</span>
              <select value={draft.channel}
                onChange={event => setDraft(previous => ({
                  ...previous, channel: event.target.value as AtlasSovereignReleaseDraftInput['channel']
                }))}>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production draft only</option>
              </select>
            </label>
            <label>
              <span>Git commit SHA (40 hex)</span>
              <input value={draft.sourceSha} maxLength={40} autoComplete="off" spellCheck={false}
                onChange={event => setDraft(previous => ({ ...previous, sourceSha: event.target.value }))}
                placeholder="40 hexadecimal characters" required />
            </label>
            <label>
              <span>Artifact SHA-256 (64 hex)</span>
              <input value={draft.artifactSha256} maxLength={64} autoComplete="off" spellCheck={false}
                onChange={event => setDraft(previous => ({ ...previous, artifactSha256: event.target.value }))}
                placeholder="Actual bundle digest, never a placeholder" required />
            </label>
          </div>

          <p className="atlas-cloud-truth-note">The Git commit SHA and built bundle SHA-256 are different facts. A supplied digest is not automatically verified. The draft remains blocked from production until separately authorized release gates and exact-SHA runtime checks pass.</p>
          <button type="submit" disabled={!canCreate}>
            {busy ? 'Creating draft…' : 'Create release draft'}
          </button>
        </form>
      )}

      {error && <p role="alert">{error}</p>}
      {createdId && <p role="status">Draft created in ATLAS Release Control: <code>{createdId}</code>. It is not deployed.</p>}
    </section>
  );
}
