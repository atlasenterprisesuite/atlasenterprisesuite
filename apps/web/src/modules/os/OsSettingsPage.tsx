import { useEffect, useMemo, useState } from 'react';
import {
  OS_NOTIFICATION_CLASSES,
  canManageOrganizationOsSettings,
  effectiveOsSettings,
  type OrganizationOsPolicy,
  type PersonalOsSettings
} from '../../../../../packages/core/src/os-settings';
import {
  getOsSettings,
  saveOrganizationOsPolicy,
  savePersonalOsSettings,
  type OsSettingsSnapshot
} from './settingsApi';
import './os-settings.css';

function Toggle({
  checked,
  disabled,
  label,
  description,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="os-setting-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function AdapterState({ name, state }: { name: string; state: 'not_verified' | 'verified' }) {
  return (
    <div className="os-adapter-card">
      <strong>{name}</strong>
      <span className={state === 'verified' ? 'os-state verified' : 'os-state unverified'}>
        {state === 'verified' ? 'Verified' : 'Not verified'}
      </span>
      <small>{state === 'verified' ? 'Server evidence is available.' : 'No native delivery or device-management claim is made.'}</small>
    </div>
  );
}

export function OsSettingsPage() {
  const [snapshot, setSnapshot] = useState<OsSettingsSnapshot | null>(null);
  const [personal, setPersonal] = useState<PersonalOsSettings | null>(null);
  const [organization, setOrganization] = useState<OrganizationOsPolicy | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const load = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const next = await getOsSettings();
      setSnapshot(next);
      setPersonal(next.personal);
      setOrganization(next.organization);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to load settings');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const effective = useMemo(
    () => personal && organization ? effectiveOsSettings(personal, organization) : null,
    [personal, organization]
  );
  const canManageOrganization = canManageOrganizationOsSettings(snapshot?.role);

  const savePersonal = async () => {
    if (!snapshot || !personal) return;
    setStatus('saving');
    setMessage('');
    try {
      const next = await savePersonalOsSettings(personal, snapshot.personalVersion);
      setSnapshot(next);
      setPersonal(next.personal);
      setOrganization(next.organization);
      setStatus('ready');
      setMessage('Personal settings saved.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error && error.message === 'version_conflict'
        ? 'Settings changed in another session. Reload before saving again.'
        : error instanceof Error ? error.message : 'Unable to save personal settings');
    }
  };

  const saveOrganization = async () => {
    if (!snapshot || !organization || !canManageOrganization) return;
    setStatus('saving');
    setMessage('');
    try {
      const next = await saveOrganizationOsPolicy(organization, snapshot.organizationVersion);
      setSnapshot(next);
      setPersonal(next.personal);
      setOrganization(next.organization);
      setStatus('ready');
      setMessage('Organization policy saved.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error && error.message === 'version_conflict'
        ? 'Organization policy changed in another session. Reload before saving again.'
        : error instanceof Error ? error.message : 'Unable to save organization policy');
    }
  };

  const exportSettings = () => {
    if (!snapshot || !effective) return;
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      role: snapshot.role,
      personal: snapshot.personal,
      organization: snapshot.organization,
      effective,
      externalDelivery: snapshot.externalDelivery
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'atlas-os-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading' && !snapshot) {
    return <section className="os-settings-shell" aria-busy="true"><div className="os-loading">Loading ATLAS OS Settings…</div></section>;
  }

  if (!snapshot || !personal || !organization || !effective) {
    return (
      <section className="os-settings-shell">
        <div className="os-error" role="alert"><strong>Settings unavailable</strong><span>{message || 'Authenticated organization context is required.'}</span><button onClick={() => void load()}>Retry</button></div>
      </section>
    );
  }

  return (
    <section className="os-settings-shell">
      <header className="os-settings-header">
        <div>
          <p className="eyebrow">OS & Devices</p>
          <h1>ATLAS OS Settings</h1>
          <p>Identity-scoped preferences and organization policy. ATLAS does not report native delivery, device control or external connectivity without verified adapter evidence.</p>
        </div>
        <div className="os-header-actions">
          <button className="os-secondary" onClick={exportSettings}>Export JSON</button>
          <button className="os-secondary" onClick={() => void load()}>Reload</button>
        </div>
      </header>

      {message ? <div className={status === 'error' ? 'os-message error' : 'os-message'} role={status === 'error' ? 'alert' : 'status'}>{message}</div> : null}

      <div className="os-settings-grid">
        <article className="os-panel">
          <div className="os-panel-heading"><div><p className="eyebrow">Personal</p><h2>Continuity & recovery</h2></div><span>v{snapshot.personalVersion}</span></div>
          <Toggle checked={personal.syncEnabled} label="Sync state" description="Allow ATLAS-owned state to participate in continuity where the capability is implemented." onChange={(syncEnabled) => setPersonal({ ...personal, syncEnabled })} />
          <Toggle checked={personal.crossDeviceHandoffEnabled} label="Cross-device handoff" description="Allow stored handoff records. Native delivery still requires a verified platform adapter." onChange={(crossDeviceHandoffEnabled) => setPersonal({ ...personal, crossDeviceHandoffEnabled })} />
          <Toggle checked={personal.offlineDraftsEnabled} label="Offline-tolerant drafts" description="Permit local draft preservation for supported ATLAS surfaces." onChange={(offlineDraftsEnabled) => setPersonal({ ...personal, offlineDraftsEnabled })} />
          <Toggle checked={personal.autoBackupEnabled} label="Automatic restore points" description="Request automated restore-point creation where the backup capability is deployed." onChange={(autoBackupEnabled) => setPersonal({ ...personal, autoBackupEnabled })} />
          <label className="os-field"><span>Backup retention</span><select value={personal.backupRetentionDays} onChange={(event) => setPersonal({ ...personal, backupRetentionDays: Number(event.target.value) })}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option></select></label>
          <button className="os-primary" disabled={status === 'saving'} onClick={() => void savePersonal()}>Save personal settings</button>
        </article>

        <article className="os-panel">
          <div className="os-panel-heading"><div><p className="eyebrow">Personal</p><h2>Notifications</h2></div></div>
          <Toggle checked={personal.notificationsEnabled} label="In-app notifications" description="Control ATLAS in-app notification eligibility. Email, SMS and push require separate verified providers." onChange={(notificationsEnabled) => setPersonal({ ...personal, notificationsEnabled })} />
          <fieldset className="os-classes" disabled={!personal.notificationsEnabled}>
            <legend>Notification classes</legend>
            {OS_NOTIFICATION_CLASSES.map((item) => {
              const checked = personal.notificationClasses.includes(item);
              return <label key={item}><input type="checkbox" checked={checked} onChange={() => setPersonal({ ...personal, notificationClasses: checked ? personal.notificationClasses.filter((value) => value !== item) : [...personal.notificationClasses, item] })} /><span>{item}</span></label>;
            })}
          </fieldset>
        </article>

        <article className="os-panel organization-policy">
          <div className="os-panel-heading"><div><p className="eyebrow">Organization policy</p><h2>Organization policy</h2></div><span>v{snapshot.organizationVersion}</span></div>
          {!canManageOrganization ? <div className="os-readonly">Owner or admin role is required to change organization policy.</div> : null}
          <Toggle disabled={!canManageOrganization} checked={organization.forceBackupEnabled} label="Require backups" description="Force backup eligibility for users in this organization." onChange={(forceBackupEnabled) => setOrganization({ ...organization, forceBackupEnabled })} />
          <Toggle disabled={!canManageOrganization} checked={organization.requireVerifiedAdapters} label="Require verified adapters" description="Fail closed for native-device actions unless adapter evidence is verified." onChange={(requireVerifiedAdapters) => setOrganization({ ...organization, requireVerifiedAdapters })} />
          <Toggle disabled={!canManageOrganization} checked={organization.crossDeviceHandoffAllowed} label="Allow cross-device handoff" description="Organization-level ceiling for handoff. A user cannot override a disabled policy." onChange={(crossDeviceHandoffAllowed) => setOrganization({ ...organization, crossDeviceHandoffAllowed })} />
          <label className="os-field"><span>Minimum backup retention</span><select disabled={!canManageOrganization} value={organization.minimumBackupRetentionDays} onChange={(event) => setOrganization({ ...organization, minimumBackupRetentionDays: Number(event.target.value) })}><option value={1}>1 day</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option></select></label>
          <label className="os-field"><span>Device actions</span><select disabled={!canManageOrganization} value={organization.deviceActionsMode} onChange={(event) => setOrganization({ ...organization, deviceActionsMode: event.target.value as OrganizationOsPolicy['deviceActionsMode'] })}><option value="deny">Deny</option><option value="confirm">Require confirmation</option><option value="allow">Allow when authorized</option></select></label>
          <button className="os-primary" disabled={!canManageOrganization || status === 'saving'} onClick={() => void saveOrganization()}>Save organization policy</button>
        </article>

        <article className="os-panel">
          <div className="os-panel-heading"><div><p className="eyebrow">Effective</p><h2>Effective settings</h2></div></div>
          <dl className="os-effective">
            <div><dt>Sync</dt><dd>{effective.syncEnabled ? 'Enabled' : 'Disabled'}</dd></div>
            <div><dt>Handoff</dt><dd>{effective.crossDeviceHandoffEnabled ? 'Enabled' : 'Disabled by user/policy'}</dd></div>
            <div><dt>Backup</dt><dd>{effective.autoBackupEnabled ? 'Required / enabled' : 'Optional'}</dd></div>
            <div><dt>Retention</dt><dd>{effective.backupRetentionDays} days</dd></div>
            <div><dt>Adapter policy</dt><dd>{effective.requireVerifiedAdapters ? 'Verified required' : 'Verification not enforced by policy'}</dd></div>
            <div><dt>Device actions</dt><dd>{effective.deviceActionsMode}</dd></div>
          </dl>
          <p className="os-truth-note">Persistence of this policy is real. A setting does not by itself prove that Sync, Backup, Notifications or a native OS adapter is deployed in the current runtime.</p>
        </article>
      </div>

      <section className="os-adapters" aria-labelledby="os-adapter-title">
        <div><p className="eyebrow">Boundary status</p><h2 id="os-adapter-title">External delivery adapters</h2><p>Kernel, hardware-driver and app-store boundaries remain adapter-only. Status is fail-closed.</p></div>
        <div className="os-adapter-grid">
          <AdapterState name="Windows" state={snapshot.externalDelivery.windows} />
          <AdapterState name="macOS" state={snapshot.externalDelivery.macos} />
          <AdapterState name="iOS / iPadOS" state={snapshot.externalDelivery.ios} />
          <AdapterState name="Android" state={snapshot.externalDelivery.android} />
        </div>
      </section>
    </section>
  );
}
