import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_MODULES } from '../registry';
import {
  ATLAS_PERSONALIZATION_OBJECTIVES,
  defaultAtlasPersonalizationProfile,
  loadAtlasPersonalizationProfile,
  loadAtlasPersonalizationProfileRemote,
  recommendAtlasModules,
  resolvePersonalizationUserId,
  saveAtlasPersonalizationProfile,
  syncAtlasPersonalizationProfileRemote,
  type AtlasPersonalizationAutomationMode,
  type AtlasPersonalizationObjective,
  type AtlasPersonalizationProfile,
  type AtlasPersonalizationStartMode,
  type AtlasPersonalizationSyncStatus,
  type AtlasPersonalizationWorkMode
} from '../../services/atlasPersonalization';
import './personalize-atlas.css';

const OBJECTIVE_LABELS: Record<AtlasPersonalizationObjective, { title: string; detail: string }> = {
  'business-growth': { title: 'Grow & operate a business', detail: 'CRM, commerce, advisory, finance and operations.' },
  'money-finance': { title: 'Manage money & finance', detail: 'Finance, Pay, Tax, Payroll and purchasing.' },
  'people-workforce': { title: 'Manage people & workforce', detail: 'People, Payroll, Learning and Care.' },
  'create-publish': { title: 'Create & publish', detail: 'Studio, Voice, Events and governed AI creation.' },
  'mobility-world': { title: 'Move through the physical world', detail: 'Ride, GPS 4D, Digital City, Aviation and devices.' },
  'health-care': { title: 'Health, care & protection', detail: 'Health, Care, Insurance and learning support.' },
  'technology-automation': { title: 'Build, automate & operate technology', detail: 'Cloud, Work, Assistant, Device OS and Connect.' },
  'knowledge-learning': { title: 'Learn & preserve knowledge', detail: 'Knowledge Atlas, Learning and evidence-backed research.' }
};

const WORK_MODES: readonly { value: AtlasPersonalizationWorkMode; title: string; detail: string }[] = [
  { value: 'solo', title: 'Solo', detail: 'Prioritize personal execution, knowledge and assistant workflows.' },
  { value: 'team', title: 'Team', detail: 'Prioritize Work, People, Connect and shared knowledge.' },
  { value: 'clients', title: 'Clients', detail: 'Prioritize CRM, Advisory, Business and Finance.' },
  { value: 'public', title: 'Public / customers', detail: 'Prioritize Business, Commerce, Studio and Connect.' }
];

const AUTOMATION_MODES: readonly { value: AtlasPersonalizationAutomationMode; title: string; detail: string }[] = [
  { value: 'suggest', title: 'Suggest actions', detail: 'ATLAS recommends the next action but does not prefer execution.' },
  { value: 'confirm', title: 'Ask before execution', detail: 'Default preference for governed actions that can mutate state.' },
  { value: 'safe-auto', title: 'Prefer safe automation', detail: 'Prefer eligible low-risk automation; RBAC, policy and mandatory confirmations still win.' }
];

const START_MODES: readonly { value: AtlasPersonalizationStartMode; title: string; detail: string }[] = [
  { value: 'recommended', title: 'Recommended for me', detail: 'Prioritize modules from goals and working style.' },
  { value: 'home', title: 'ATLAS Home', detail: 'Keep the universal Command Center first.' },
  { value: 'suite', title: 'All Modules', detail: 'Open with the complete ATLAS product library.' }
];

function syncStatusText(status: AtlasPersonalizationSyncStatus | 'loading' | 'saving') {
  if (status === 'synced') return 'Personalization is synchronized with your ATLAS account.';
  if (status === 'failed') return 'Saved on this device; account synchronization is currently unavailable.';
  if (status === 'saving') return 'Saving ATLAS personalization…';
  if (status === 'loading') return 'Checking your ATLAS personalization profile…';
  return 'Saved on this device. Sign in to synchronize it across ATLAS sessions.';
}

export function PersonalizeAtlasPage() {
  const userId = resolvePersonalizationUserId();
  const [profile, setProfile] = useState<AtlasPersonalizationProfile>(() =>
    loadAtlasPersonalizationProfile(userId, ATLAS_MODULES)
  );
  const [syncStatus, setSyncStatus] = useState<AtlasPersonalizationSyncStatus | 'loading' | 'saving'>('loading');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadAtlasPersonalizationProfileRemote(userId, ATLAS_MODULES)
      .then((remote) => {
        if (cancelled) return;
        if (remote) {
          setProfile(saveAtlasPersonalizationProfile(remote, ATLAS_MODULES));
          setSyncStatus('synced');
        } else {
          setSyncStatus('local-only');
        }
      })
      .catch(() => {
        if (!cancelled) setSyncStatus('failed');
      });
    return () => { cancelled = true; };
  }, [userId]);

  const recommendations = useMemo(
    () => recommendAtlasModules(profile, ATLAS_MODULES, 8),
    [profile]
  );

  const recommendedModules = recommendations
    .map((id) => ATLAS_MODULES.find((module) => module.id === id))
    .filter((module): module is (typeof ATLAS_MODULES)[number] => Boolean(module));

  function toggleObjective(objective: AtlasPersonalizationObjective) {
    const exists = profile.objectives.includes(objective);
    setProfile((current) => ({
      ...current,
      objectives: exists
        ? current.objectives.filter((item) => item !== objective)
        : [...current.objectives, objective]
    }));
    setSaved(false);
  }

  function togglePinnedModule(moduleId: string) {
    const exists = profile.pinnedModuleIds.includes(moduleId);
    setProfile((current) => ({
      ...current,
      pinnedModuleIds: exists
        ? current.pinnedModuleIds.filter((id) => id !== moduleId)
        : current.pinnedModuleIds.length >= 6
          ? current.pinnedModuleIds
          : [...current.pinnedModuleIds, moduleId]
    }));
    setSaved(false);
  }

  async function save() {
    const normalized = saveAtlasPersonalizationProfile({
      ...profile,
      completed: profile.objectives.length > 0
    }, ATLAS_MODULES);
    setProfile(normalized);
    setSaved(true);
    setSyncStatus('saving');
    setSyncStatus(await syncAtlasPersonalizationProfileRemote(normalized, ATLAS_MODULES));
  }

  function reset() {
    const defaults = defaultAtlasPersonalizationProfile(userId);
    const normalized = saveAtlasPersonalizationProfile(defaults, ATLAS_MODULES);
    setProfile(normalized);
    setSaved(false);
    setSyncStatus('saving');
    void syncAtlasPersonalizationProfileRemote(normalized, ATLAS_MODULES).then(setSyncStatus);
  }

  return (
    <section className="page-stack atlas-personalize-page">
      <header className="page-header atlas-personalize-hero">
        <p className="eyebrow">Settings → Personalize ATLAS</p>
        <h1>Teach ATLAS what matters to you</h1>
        <p>
          Six short choices reshape recommendations without creating a separate app or weakening permissions.
          You can change them at any time.
        </p>
      </header>

      <div className="notice" role="status" aria-live="polite">{syncStatusText(syncStatus)}</div>

      <div className="atlas-personalize-grid">
        <article className="atlas-personalize-card atlas-personalize-card-wide">
          <div className="atlas-personalize-heading"><span>01</span><div><h2>What do you want ATLAS to help with?</h2><p>Select every goal that matters.</p></div></div>
          <div className="atlas-choice-grid">
            {ATLAS_PERSONALIZATION_OBJECTIVES.map((objective) => {
              const copy = OBJECTIVE_LABELS[objective];
              const selected = profile.objectives.includes(objective);
              return (
                <button
                  key={objective}
                  type="button"
                  className={selected ? 'atlas-choice is-selected' : 'atlas-choice'}
                  aria-pressed={selected}
                  onClick={() => toggleObjective(objective)}
                >
                  <strong>{copy.title}</strong><span>{copy.detail}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="atlas-personalize-card">
          <div className="atlas-personalize-heading"><span>02</span><div><h2>How do you work?</h2><p>This only changes prioritization.</p></div></div>
          <div className="atlas-choice-stack">
            {WORK_MODES.map((option) => (
              <label key={option.value} className={profile.workMode === option.value ? 'atlas-radio-choice is-selected' : 'atlas-radio-choice'}>
                <input
                  type="radio"
                  name="work-mode"
                  value={option.value}
                  checked={profile.workMode === option.value}
                  onChange={() => setProfile((current) => ({ ...current, workMode: option.value }))}
                />
                <span><strong>{option.title}</strong><small>{option.detail}</small></span>
              </label>
            ))}
          </div>
        </article>

        <article className="atlas-personalize-card">
          <div className="atlas-personalize-heading"><span>03</span><div><h2>Automation preference</h2><p>Policy, RBAC and required confirmations remain authoritative.</p></div></div>
          <div className="atlas-choice-stack">
            {AUTOMATION_MODES.map((option) => (
              <label key={option.value} className={profile.automationMode === option.value ? 'atlas-radio-choice is-selected' : 'atlas-radio-choice'}>
                <input
                  type="radio"
                  name="automation-mode"
                  value={option.value}
                  checked={profile.automationMode === option.value}
                  onChange={() => setProfile((current) => ({ ...current, automationMode: option.value }))}
                />
                <span><strong>{option.title}</strong><small>{option.detail}</small></span>
              </label>
            ))}
          </div>
        </article>

        <article className="atlas-personalize-card">
          <div className="atlas-personalize-heading"><span>04</span><div><h2>Preferred starting surface</h2><p>ATLAS can prioritize your recommended systems without hiding the rest.</p></div></div>
          <div className="atlas-choice-stack">
            {START_MODES.map((option) => (
              <label key={option.value} className={profile.startMode === option.value ? 'atlas-radio-choice is-selected' : 'atlas-radio-choice'}>
                <input
                  type="radio"
                  name="start-mode"
                  value={option.value}
                  checked={profile.startMode === option.value}
                  onChange={() => setProfile((current) => ({ ...current, startMode: option.value }))}
                />
                <span><strong>{option.title}</strong><small>{option.detail}</small></span>
              </label>
            ))}
          </div>
        </article>

        <article className="atlas-personalize-card">
          <div className="atlas-personalize-heading"><span>05</span><div><h2>Progressive discovery</h2><p>Ask more only when the answer can materially improve ATLAS.</p></div></div>
          <label className="atlas-progressive-toggle">
            <input
              type="checkbox"
              checked={profile.progressiveDiscovery}
              onChange={(event) => setProfile((current) => ({ ...current, progressiveDiscovery: event.target.checked }))}
            />
            <span><strong>{profile.progressiveDiscovery ? 'Enabled' : 'Disabled'}</strong><small>No repeated questionnaire when the current profile is sufficient.</small></span>
          </label>
        </article>

        <article className="atlas-personalize-card atlas-personalize-card-wide">
          <div className="atlas-personalize-heading"><span>06</span><div><h2>Pin systems you always want nearby</h2><p>Optional · up to six. This does not change module permissions.</p></div></div>
          <div className="atlas-pin-grid">
            {ATLAS_MODULES.filter((module) => module.showInNavigation).map((module) => {
              const selected = profile.pinnedModuleIds.includes(module.id);
              return (
                <button
                  key={module.id}
                  type="button"
                  className={selected ? 'atlas-pin is-selected' : 'atlas-pin'}
                  aria-pressed={selected}
                  onClick={() => togglePinnedModule(module.id)}
                  disabled={!selected && profile.pinnedModuleIds.length >= 6}
                >
                  <span>{module.area}</span><strong>{module.navLabel}</strong>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <section className="atlas-personalize-preview" aria-labelledby="atlas-personalize-preview-title">
        <div>
          <p className="eyebrow">Adaptive preview</p>
          <h2 id="atlas-personalize-preview-title">Your recommended ATLAS surface</h2>
          <p>Recommendations are derived from the canonical module registry; no new module is invented by the survey.</p>
        </div>
        <div className="atlas-personalize-recommendations">
          {recommendedModules.length ? recommendedModules.map((module, index) => (
            <Link key={module.id} to={module.route}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><small>{module.area}</small><strong>{module.title}</strong></div>
              <span aria-hidden="true">↗</span>
            </Link>
          )) : <div className="empty-state"><strong>Select at least one goal</strong><span>ATLAS will build recommendations from your choices.</span></div>}
        </div>
      </section>

      <div className="atlas-personalize-actions">
        <button type="button" className="atlas-personalize-save" onClick={() => void save()} disabled={profile.objectives.length === 0}>
          Save personalization
        </button>
        <button type="button" className="atlas-personalize-reset" onClick={reset}>Reset</button>
        {saved ? <span role="status">Personalization updated.</span> : null}
      </div>

      <div className="notice strong">
        Personalization controls ordering and recommendations only. Authentication, tenant scope, RBAC, provider readiness,
        regulated actions and release gates are never relaxed by this profile.
      </div>
    </section>
  );
}
