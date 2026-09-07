import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildNeuroplasticityPlan,
  completionPercent,
  nextReviewDate,
  validateProfile
} from '../../../../../packages/learning/neuroplasticity';
import type {
  ExperienceLevel,
  NeuroplasticityGoal,
  NeuroplasticityProfile
} from '../../../../../packages/learning/neuroplasticity';
import { deleteProgram, loadProgram, resolvePersistence, saveProgram } from './neuroplasticityRepository';
import type { PersistenceState } from './neuroplasticityRepository';

const defaultProfile: NeuroplasticityProfile = {
  goal: 'focus',
  minutesPerDay: 30,
  experienceLevel: 'beginner',
  sleepHours: 8,
  exerciseDaysPerWeek: 3,
  hasNeurologicalCondition: false
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function NeuroplasticityProgramPage({ entry }: { entry: 'health' | 'learning' }) {
  const [profile, setProfile] = useState<NeuroplasticityProfile>(defaultProfile);
  const [activeProfile, setActiveProfile] = useState<NeuroplasticityProfile | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today());
  const [persistence, setPersistence] = useState<PersistenceState>({ status: 'unconfigured' });
  const [syncStatus, setSyncStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [syncMessage, setSyncMessage] = useState('Checking secure storage…');
  const [errors, setErrors] = useState<string[]>([]);
  const plan = useMemo(() => activeProfile ? buildNeuroplasticityPlan(activeProfile) : null, [activeProfile]);
  const progress = plan ? completionPercent(completedIds, plan.blocks) : 0;

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const context = await resolvePersistence();
        if (cancelled) return;
        setPersistence(context);
        if (context.status !== 'ready') {
          setSyncStatus('ready');
          setSyncMessage(context.status === 'signed-out' ? 'Sign in to save this program.' : 'Supabase environment is not configured.');
          return;
        }
        const stored = await loadProgram(context);
        if (cancelled) return;
        if (stored) {
          setProfile(stored.profile);
          setActiveProfile(stored.profile);
          setCompletedIds(stored.completedIds);
          setStartDate(stored.startDate);
          setSyncMessage('Program loaded from Supabase.');
        } else {
          setSyncMessage('Secure storage ready. No saved program yet.');
        }
        setSyncStatus('ready');
      } catch {
        if (!cancelled) {
          setSyncStatus('error');
          setSyncMessage('Secure storage could not be reached. Your changes were not saved.');
        }
      }
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  async function persist(nextProfile: NeuroplasticityProfile, nextCompleted: string[], nextStartDate: string) {
    if (persistence.status !== 'ready') return;
    setSyncStatus('saving');
    setSyncMessage('Saving securely…');
    try {
      await saveProgram(persistence, { profile: nextProfile, completedIds: nextCompleted, startDate: nextStartDate });
      setSyncStatus('saved');
      setSyncMessage('Saved to Supabase.');
    } catch {
      setSyncStatus('error');
      setSyncMessage('Save failed. Your last confirmed cloud version was preserved.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateProfile(profile);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    setActiveProfile(profile);
    setCompletedIds([]);
    const nextStartDate = today();
    setStartDate(nextStartDate);
    await persist(profile, [], nextStartDate);
  }

  async function toggleBlock(blockId: string) {
    if (!activeProfile) return;
    const next = completedIds.includes(blockId)
      ? completedIds.filter((id) => id !== blockId)
      : [...completedIds, blockId];
    setCompletedIds(next);
    await persist(activeProfile, next, startDate);
  }

  async function reset() {
    if (persistence.status === 'ready') await deleteProgram(persistence);
    setProfile(defaultProfile);
    setActiveProfile(null);
    setCompletedIds([]);
    setErrors([]);
    setStartDate(today());
  }

  return (
    <section className="page-stack neuro-program">
      <header className="page-header">
        <p className="eyebrow">{entry === 'health' ? 'ATLAS Health · Wellbeing' : 'ATLAS Learning · Practice Lab'}</p>
        <h1>Neuroplasticity Program</h1>
        <p>Build a repeatable learning routine using progressive challenge, active recall, attention practice, movement and recovery.</p>
      </header>

      <div className="ownership-strip" aria-label="Module ownership">
        <span><strong>Health:</strong> readiness, recovery and safety</span>
        <span><strong>Learning:</strong> practice, recall and spaced review</span>
      </div>

      <nav className="context-tabs" aria-label="Neuroplasticity module navigation">
        <Link className={entry === 'health' ? 'active' : ''} to="/health/wellbeing/neuroplasticity">Health view</Link>
        <Link className={entry === 'learning' ? 'active' : ''} to="/learning/neuroplasticity">Learning view</Link>
      </nav>

      <div className="notice strong">General education only. This program does not diagnose, treat or measure neurological change. Progress reflects completed activities, not clinical improvement.</div>

      <div className="neuro-layout">
        <form className="feature-card neuro-form" onSubmit={submit} noValidate>
          <div>
            <p className="eyebrow">Assessment</p>
            <h2>Create your daily plan</h2>
          </div>

          <label className="field">
            <span>Primary goal</span>
            <select value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value as NeuroplasticityGoal })}>
              <option value="focus">Improve focus</option>
              <option value="memory">Practice memory</option>
              <option value="language">Learn a language</option>
              <option value="professional">Build a professional skill</option>
              <option value="motor">Practice a movement skill</option>
            </select>
          </label>

          <label className="field">
            <span>Experience level</span>
            <select value={profile.experienceLevel} onChange={(event) => setProfile({ ...profile, experienceLevel: event.target.value as ExperienceLevel })}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <div className="form-pair">
            <label className="field">
              <span>Minutes per day</span>
              <input type="number" min="15" max="120" value={profile.minutesPerDay} onChange={(event) => setProfile({ ...profile, minutesPerDay: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>Average sleep hours</span>
              <input type="number" min="0" max="24" step="0.5" value={profile.sleepHours} onChange={(event) => setProfile({ ...profile, sleepHours: Number(event.target.value) })} />
            </label>
          </div>

          <label className="field">
            <span>Exercise days per week</span>
            <input type="number" min="0" max="7" step="1" value={profile.exerciseDaysPerWeek} onChange={(event) => setProfile({ ...profile, exerciseDaysPerWeek: Number(event.target.value) })} />
          </label>

          <label className="check-field">
            <input type="checkbox" checked={profile.hasNeurologicalCondition} onChange={(event) => setProfile({ ...profile, hasNeurologicalCondition: event.target.checked })} />
            <span>I am using this after a stroke, brain injury, neurological diagnosis or significant memory change.</span>
          </label>

          {errors.length > 0 && <div className="form-errors" role="alert"><strong>Review the assessment</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

          <button className="primary-button" type="submit">{plan ? 'Rebuild plan' : 'Build my plan'}</button>
          {plan && <button className="secondary-button" type="button" onClick={reset}>Reset program</button>}
          <small className={syncStatus === 'error' ? 'local-note sync-error' : 'local-note'} aria-live="polite">{syncMessage} No clinical record is created.</small>
        </form>

        <div className="page-stack">
          {!plan ? (
            <div className="empty-state neuro-empty">
              <strong>No active plan</strong>
              <span>Complete the assessment to generate a daily routine and review schedule.</span>
            </div>
          ) : (
            <>
              <section className="feature-card progress-card" aria-label="Daily progress">
                <div><p className="eyebrow">Today</p><h2>{progress}% complete</h2></div>
                <div className="progress-track" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>
                <p>{plan.totalMinutes} planned minutes · {completedIds.length} of {plan.blocks.length} activities</p>
              </section>

              {plan.professionalReviewRecommended && (
                <div className="clinical-warning" role="alert">
                  <strong>Professional guidance recommended</strong>
                  <span>{plan.safetyMessage}</span>
                </div>
              )}

              <div className="practice-list" aria-label="Daily practice">
                {plan.blocks.map((block) => {
                  const completed = completedIds.includes(block.id);
                  return (
                    <article className={completed ? 'practice-card completed' : 'practice-card'} key={block.id}>
                      <button type="button" aria-pressed={completed} onClick={() => toggleBlock(block.id)}>
                        <span className="practice-check">{completed ? '✓' : ''}</span>
                        <span>
                          <small>{block.owner === 'health' ? 'ATLAS Health' : 'ATLAS Learning'} · {block.minutes} min</small>
                          <strong>{block.title}</strong>
                          <p>{block.instruction}</p>
                          <em>{block.purpose}</em>
                        </span>
                      </button>
                    </article>
                  );
                })}
              </div>

              <section className="feature-card review-card">
                <p className="eyebrow">Spaced review</p>
                <h2>Review schedule</h2>
                <label className="field"><span>Program start</span><input type="date" value={startDate} onChange={(event) => { const next = event.target.value; setStartDate(next); if (activeProfile) void persist(activeProfile, completedIds, next); }} /></label>
                <div className="review-grid">
                  {plan.reviewDays.map((day) => <div key={day}><strong>Day {day}</strong><span>{nextReviewDate(startDate, day)}</span></div>)}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
