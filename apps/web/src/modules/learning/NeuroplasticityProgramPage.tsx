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

const STORAGE_KEY = 'atlas.neuroplasticity.v1';

const defaultProfile: NeuroplasticityProfile = {
  goal: 'focus',
  minutesPerDay: 30,
  experienceLevel: 'beginner',
  sleepHours: 8,
  exerciseDaysPerWeek: 3,
  hasNeurologicalCondition: false
};

type SavedProgram = {
  profile: NeuroplasticityProfile;
  completedIds: string[];
  startDate: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readSavedProgram(): SavedProgram | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgram;
    return validateProfile(parsed.profile).length === 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function NeuroplasticityProgramPage({ entry }: { entry: 'health' | 'learning' }) {
  const saved = useMemo(readSavedProgram, []);
  const [profile, setProfile] = useState<NeuroplasticityProfile>(saved?.profile ?? defaultProfile);
  const [activeProfile, setActiveProfile] = useState<NeuroplasticityProfile | null>(saved?.profile ?? null);
  const [completedIds, setCompletedIds] = useState<string[]>(saved?.completedIds ?? []);
  const [startDate, setStartDate] = useState(saved?.startDate ?? today());
  const [errors, setErrors] = useState<string[]>([]);
  const plan = useMemo(() => activeProfile ? buildNeuroplasticityPlan(activeProfile) : null, [activeProfile]);
  const progress = plan ? completionPercent(completedIds, plan.blocks) : 0;

  useEffect(() => {
    if (!activeProfile) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: activeProfile, completedIds, startDate }));
  }, [activeProfile, completedIds, startDate]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateProfile(profile);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    setActiveProfile(profile);
    setCompletedIds([]);
    setStartDate(today());
  }

  function toggleBlock(blockId: string) {
    setCompletedIds((current) => current.includes(blockId)
      ? current.filter((id) => id !== blockId)
      : [...current, blockId]);
  }

  function reset() {
    window.localStorage.removeItem(STORAGE_KEY);
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
          <small className="local-note">Saved only in this browser. No clinical record or cloud connection is active.</small>
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
                <label className="field"><span>Program start</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
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
