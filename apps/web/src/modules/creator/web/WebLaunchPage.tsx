import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  auditConversion,
  buildConstructionPlan,
  buildCopyPlan,
  buildHeroPlan,
  buildLaunchPlan,
  buildMasterPlan,
  buildMotionPlan,
  createWebLaunchBlueprintState,
  type WebLaunchBlueprint,
  type WebLaunchProfile
} from '../../../../../../packages/creator/web_launch';
import {
  getWebLaunchBlueprint,
  listWebLaunchBlueprints,
  saveWebLaunchBlueprint,
  type WebLaunchBlueprintRecord
} from '../../../lib/creatorApi';
import './web-launch.css';

const STAGES = [
  'Master Plan',
  'First Impression',
  'Motion System',
  'Conversion Copy',
  'Construction Plan',
  'Conversion Audit',
  '30-Day Launch'
] as const;

type Stage = typeof STAGES[number];
type StageResult = Record<string, string | string[]>;

function createId() {
  return globalThis.crypto?.randomUUID?.() || '00000000-0000-4000-8000-000000000001';
}

function newBlueprint(): WebLaunchBlueprint {
  const state = createWebLaunchBlueprintState(createId());
  const now = new Date().toISOString();
  return { ...state, createdAt: now, updatedAt: now };
}

function stripRecord(record: WebLaunchBlueprintRecord): WebLaunchBlueprint {
  const { organizationId: _organizationId, createdByUserId: _createdByUserId, ...state } = record;
  return state;
}

function stageResult(blueprint: WebLaunchBlueprint, stage: Stage): StageResult | null {
  if (stage === 'Master Plan') return blueprint.masterPlan as StageResult | null;
  if (stage === 'First Impression') return blueprint.hero as StageResult | null;
  if (stage === 'Motion System') return blueprint.motion as StageResult | null;
  if (stage === 'Conversion Copy') return blueprint.copy as StageResult | null;
  if (stage === 'Construction Plan') return blueprint.construction as StageResult | null;
  if (stage === 'Conversion Audit') return blueprint.conversionAudit as StageResult | null;
  return blueprint.launchPlan as StageResult | null;
}

function labelFromKey(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase());
}

function ResultPanel({ result }: { result: StageResult | null }) {
  if (!result) {
    return <div className="web-launch-empty">
      <strong>Stage not generated yet.</strong>
      <span>Complete the project context, then generate this stage. ATLAS uses only the information provided here and does not invent external research.</span>
    </div>;
  }

  return <div className="web-launch-result-grid">
    {Object.entries(result).map(([key, value]) => <article key={key}>
      <p className="eyebrow">{labelFromKey(key)}</p>
      {Array.isArray(value)
        ? <ul>{value.map((item, index) => <li key={`${key}-${index}`}>{item}</li>)}</ul>
        : <p>{value}</p>}
    </article>)}
  </div>;
}

export function WebLaunchPage() {
  const [activeStage, setActiveStage] = useState<Stage>('Master Plan');
  const [blueprint, setBlueprint] = useState<WebLaunchBlueprint>(() => newBlueprint());
  const [saved, setSaved] = useState<WebLaunchBlueprintRecord[]>([]);
  const [libraryState, setLibraryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    listWebLaunchBlueprints()
      .then(rows => {
        if (!active) return;
        setSaved(rows);
        setLibraryState('ready');
      })
      .catch(error => {
        if (!active) return;
        setLibraryState('error');
        setNotice(error instanceof Error ? error.message : 'web_launch_library_unavailable');
      });
    return () => { active = false; };
  }, []);

  const completion = useMemo(() => [
    blueprint.masterPlan,
    blueprint.hero,
    blueprint.motion,
    blueprint.copy,
    blueprint.construction,
    blueprint.conversionAudit,
    blueprint.launchPlan
  ].filter(Boolean).length, [blueprint]);

  const canGenerate = blueprint.profile.brand.trim().length > 1
    && blueprint.profile.audience.trim().length > 1
    && blueprint.profile.promise.trim().length > 1;

  function updateProfile<K extends keyof WebLaunchProfile>(key: K, value: WebLaunchProfile[K]) {
    setBlueprint(current => ({
      ...current,
      profile: { ...current.profile, [key]: value },
      updatedAt: new Date().toISOString()
    }));
    setSaveState('idle');
  }

  function generate(stage: Stage) {
    if (!canGenerate) {
      setNotice('Brand, audience and primary promise are required before generating the launch blueprint.');
      return;
    }
    setBlueprint(current => {
      if (stage === 'Master Plan') return { ...current, masterPlan: buildMasterPlan(current.profile) };
      if (stage === 'First Impression') return { ...current, hero: buildHeroPlan(current.profile) };
      if (stage === 'Motion System') return { ...current, motion: buildMotionPlan(current.profile) };
      if (stage === 'Conversion Copy') return { ...current, copy: buildCopyPlan(current.profile) };
      if (stage === 'Construction Plan') return { ...current, construction: buildConstructionPlan() };
      if (stage === 'Conversion Audit') return { ...current, conversionAudit: auditConversion(current) };
      return { ...current, launchPlan: buildLaunchPlan() };
    });
    setSaveState('idle');
    setNotice(`${stage} generated from current project context.`);
  }

  function generateAll() {
    if (!canGenerate) {
      setNotice('Brand, audience and primary promise are required before generating the launch blueprint.');
      return;
    }
    setBlueprint(current => {
      const next: WebLaunchBlueprint = {
        ...current,
        masterPlan: buildMasterPlan(current.profile),
        hero: buildHeroPlan(current.profile),
        motion: buildMotionPlan(current.profile),
        copy: buildCopyPlan(current.profile),
        construction: buildConstructionPlan(),
        conversionAudit: null,
        launchPlan: buildLaunchPlan(),
        updatedAt: new Date().toISOString()
      };
      next.conversionAudit = auditConversion(next);
      return next;
    });
    setSaveState('idle');
    setNotice('Complete seven-stage website launch blueprint generated.');
  }

  async function persist() {
    setSaveState('saving');
    setNotice('');
    try {
      const savedRecord = await saveWebLaunchBlueprint(blueprint, blueprint.version);
      const state = stripRecord(savedRecord);
      setBlueprint(state);
      setSaved(rows => [savedRecord, ...rows.filter(row => row.id !== savedRecord.id)]);
      setSaveState('saved');
      setNotice(`Blueprint saved · version ${savedRecord.version}`);
    } catch (error) {
      setSaveState('error');
      setNotice(error instanceof Error ? error.message : 'web_launch_save_failed');
    }
  }

  async function load(id: string) {
    if (!id) return;
    setNotice('');
    try {
      const record = await getWebLaunchBlueprint(id);
      setBlueprint(stripRecord(record));
      setActiveStage('Master Plan');
      setSaveState('saved');
      setNotice(`Loaded ${record.title} · version ${record.version}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'web_launch_load_failed');
    }
  }

  function reset() {
    setBlueprint(newBlueprint());
    setActiveStage('Master Plan');
    setSaveState('idle');
    setNotice('New web launch blueprint started.');
  }

  const result = stageResult(blueprint, activeStage);

  return <section className="creator-page web-launch-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb">
      <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Web Launch Lab</span>
    </nav>

    <header className="web-launch-header">
      <div>
        <p className="eyebrow">ATLAS Studio · Web Launch Lab</p>
        <h1>From idea to verified launch.</h1>
        <p>Seven governed stages turn project context into a production-ready website blueprint: structure, hero, motion, copy, construction, conversion audit and a 30-day launch plan.</p>
      </div>
      <div className="web-launch-header-actions">
        <label>
          <span>Saved blueprints</span>
          <select aria-label="Saved web launch blueprints" onChange={event => load(event.target.value)} defaultValue="">
            <option value="" disabled>{libraryState === 'loading' ? 'Loading…' : libraryState === 'error' ? 'Library unavailable' : 'Select a blueprint'}</option>
            {saved.map(item => <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>)}
          </select>
        </label>
        <div>
          <button className="creator-secondary" type="button" onClick={reset}>New</button>
          <button className="creator-primary" type="button" onClick={persist} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Saving…' : 'Save blueprint'}
          </button>
        </div>
      </div>
    </header>

    {notice && <p className={`web-launch-notice ${saveState === 'error' ? 'error' : ''}`} role="status">{notice}</p>}

    <section className="web-launch-context" aria-labelledby="web-launch-context-title">
      <div className="web-launch-context-heading">
        <div>
          <p className="eyebrow">Project context</p>
          <h2 id="web-launch-context-title">What ATLAS may use</h2>
        </div>
        <span>{completion}/7 stages generated</span>
      </div>

      <div className="web-launch-form-grid">
        <label><span>Blueprint title</span><input value={blueprint.title} onChange={event => setBlueprint(current => ({ ...current, title: event.target.value }))} /></label>
        <label><span>Brand / product</span><input value={blueprint.profile.brand} onChange={event => updateProfile('brand', event.target.value)} placeholder="ATLAS Enterprise Suite" /></label>
        <label><span>Primary audience</span><input value={blueprint.profile.audience} onChange={event => updateProfile('audience', event.target.value)} placeholder="Who must understand and act?" /></label>
        <label><span>Primary promise</span><input value={blueprint.profile.promise} onChange={event => updateProfile('promise', event.target.value)} placeholder="Outcome the visitor should understand" /></label>
        <label><span>Verified proof</span><input value={blueprint.profile.proof} onChange={event => updateProfile('proof', event.target.value)} placeholder="Evidence, testimonial, metric or leave blank" /></label>
        <label><span>Primary action</span><input value={blueprint.profile.primaryAction} onChange={event => updateProfile('primaryAction', event.target.value)} placeholder="Start, Book demo, Create account…" /></label>
        <label><span>Tone</span><input value={blueprint.profile.tone} onChange={event => updateProfile('tone', event.target.value)} placeholder="Futuristic, precise, premium…" /></label>
        <label><span>Language</span><select value={blueprint.profile.language} onChange={event => updateProfile('language', event.target.value)}><option>English</option><option>Spanish</option></select></label>
        <label className="span-2"><span>Competitor references supplied by you</span><textarea rows={2} value={blueprint.profile.competitors.join('\n')} onChange={event => updateProfile('competitors', event.target.value.split('\n').map(value => value.trim()).filter(Boolean))} placeholder="One verified reference per line. ATLAS does not infer competitor research." /></label>
      </div>

      <div className="web-launch-context-actions">
        <button className="creator-primary" type="button" onClick={generateAll} disabled={!canGenerate}>Generate all 7 stages</button>
        <span>Zero-cost deterministic planning. No external provider or web research is claimed.</span>
      </div>
    </section>

    <nav className="web-launch-stages" aria-label="Web launch stages">
      {STAGES.map((stage, index) => <button
        key={stage}
        type="button"
        className={activeStage === stage ? 'active' : ''}
        aria-current={activeStage === stage ? 'step' : undefined}
        onClick={() => setActiveStage(stage)}
      >
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>{stage}</strong>
        <small>{stageResult(blueprint, stage) ? 'Ready' : 'Not generated'}</small>
      </button>)}
    </nav>

    <div className="web-launch-shell">
      <main className="web-launch-stage-panel">
        <div className="web-launch-stage-heading">
          <div><p className="eyebrow">Stage {STAGES.indexOf(activeStage) + 1}</p><h2>{activeStage}</h2></div>
          <button className="creator-secondary" type="button" onClick={() => generate(activeStage)} disabled={!canGenerate}>Generate stage</button>
        </div>
        <ResultPanel result={result} />
      </main>

      <aside className="web-launch-side-panel">
        <p className="eyebrow">Launch controls</p>
        <h2>Fail closed by default</h2>
        <p>The final deployment is not considered verified when the canonical public domain or a critical ATLAS Network route fails.</p>
        <dl>
          <div><dt>Persistence</dt><dd>{blueprint.version ? `Saved v${blueprint.version}` : 'Not saved'}</dd></div>
          <div><dt>External research</dt><dd>Not inferred</dd></div>
          <div><dt>Assets</dt><dd>Reuse Creator Library first</dd></div>
          <div><dt>Route</dt><dd>/studio/web-launch</dd></div>
        </dl>
        <Link className="content-handoff-action" to="/studio/library">Review Creator Library <span>→</span></Link>
        <Link className="content-handoff-action" to="/execution/manager/readiness">Open deployment readiness <span>→</span></Link>
      </aside>
    </div>
  </section>;
}
