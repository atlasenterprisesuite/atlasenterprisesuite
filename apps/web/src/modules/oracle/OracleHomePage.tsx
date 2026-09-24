import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createOracleReading,
  listOracleReadings,
  type OracleReadingSummary,
  type OracleReadingType
} from '../../lib/oracleApi';

const readingOptions: ReadonlyArray<{ type: OracleReadingType; label: string; description: string }> = [
  { type: 'daily', label: 'Daily Reading', description: 'Energy, what to notice, and direction for today.' },
  { type: 'love', label: 'Love', description: 'Reflect on connection, reciprocity, boundaries, and emotional clarity.' },
  { type: 'money', label: 'Money', description: 'Reflect on resources, priorities, restraint, and practical next steps.' },
  { type: 'work', label: 'Work', description: 'Reflect on direction, opportunities, decisions, and professional energy.' },
  { type: 'emotional', label: 'Emotional reflection', description: 'Name what is present and create space before reacting.' },
  { type: 'spiritual', label: 'Spiritual message', description: 'Explore values, intuition, meaning, and inner direction.' },
  { type: 'full', label: 'Full Reading', description: 'Seven positions across general energy, love, money, work, challenge, advice, and closing.' }
];

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function OracleHomePage() {
  const navigate = useNavigate();
  const [readings, setReadings] = useState<OracleReadingSummary[]>([]);
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [creating, setCreating] = useState<OracleReadingType | null>(null);
  const [focus, setFocus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listOracleReadings()
      .then((result) => {
        if (!active) return;
        setReadings(result.readings || []);
        setHistoryState('ready');
      })
      .catch(() => {
        if (active) setHistoryState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  async function startReading(type: OracleReadingType) {
    if (creating) return;
    setCreating(type);
    setError('');
    try {
      const result = await createOracleReading({ reading_type: type, focus: focus.trim() || undefined });
      if (!result.reading?.id) throw new Error('oracle_reading_missing');
      navigate(`/assistant/oracle/readings/${result.reading.id}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message === 'oracle_deck_insufficient'
        ? 'This reading needs more verified cards than are currently available.'
        : 'ATLAS could not create this private reading. Try again.');
      setCreating(null);
    }
  }

  function handleFocusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="oracle-page oracle-home">
      <header className="oracle-hero">
        <div className="oracle-moon" aria-hidden="true"><span /></div>
        <p className="oracle-kicker">Mensajes del Oráculo Místico</p>
        <h1>ATLAS Mystic Oracle</h1>
        <p className="oracle-lead">A private space for symbolic reflection using only the cards verified from your approved mystical deck.</p>
        <div className="oracle-truth-chip">Private · Owner-scoped · 7 verified cards</div>
      </header>

      <div className="oracle-disclaimer" role="note">
        <strong>Reflection boundary</strong>
        <span>Every reading is symbolic reflection, not a guaranteed prediction or medical, financial, or legal advice.</span>
      </div>

      <form className="oracle-focus" onSubmit={handleFocusSubmit}>
        <label htmlFor="oracle-focus-input">Optional focus or question</label>
        <textarea
          id="oracle-focus-input"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          maxLength={2000}
          placeholder="What would you like to reflect on?"
          disabled={Boolean(creating)}
        />
        <small>{focus.length}/2000 · Your focus is stored only with your private reading.</small>
      </form>

      <section aria-labelledby="oracle-new-reading">
        <div className="oracle-section-heading">
          <div><p className="oracle-kicker">Choose a spread</p><h2 id="oracle-new-reading">New private reading</h2></div>
          <Link to="/assistant/oracle/deck">View verified deck</Link>
        </div>
        <div className="oracle-reading-grid">
          {readingOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              className="oracle-reading-option"
              onClick={() => void startReading(option.type)}
              disabled={Boolean(creating)}
              aria-busy={creating === option.type}
            >
              <span className="oracle-card-sigil" aria-hidden="true">✦</span>
              <strong>{option.label}</strong>
              <span>{option.description}</span>
              <small>{creating === option.type ? 'Drawing verified cards…' : 'Begin reflection'}</small>
            </button>
          ))}
        </div>
        <div className="oracle-live-status" aria-live="polite">
          {creating ? `Creating your ${readingOptions.find((item) => item.type === creating)?.label || 'Oracle'} reading…` : ''}
          {error ? <span role="alert">{error}</span> : null}
        </div>
      </section>

      <section aria-labelledby="oracle-recent-readings">
        <div className="oracle-section-heading">
          <div><p className="oracle-kicker">Owner-only history</p><h2 id="oracle-recent-readings">Recent readings</h2></div>
        </div>
        {historyState === 'loading' ? <div className="oracle-empty" role="status">Loading private history…</div> : null}
        {historyState === 'error' ? <div className="oracle-empty" role="alert">Private history could not be loaded.</div> : null}
        {historyState === 'ready' && readings.length === 0 ? <div className="oracle-empty">No private readings yet.</div> : null}
        {historyState === 'ready' && readings.length > 0 ? (
          <div className="oracle-history-list">
            {readings.map((reading) => (
              <Link key={reading.id} to={`/assistant/oracle/readings/${reading.id}`} className="oracle-history-item">
                <span><strong>{reading.reading_type}</strong><small>{reading.prompt_context || 'No focus saved'}</small></span>
                <time dateTime={reading.created_at}>{formatDate(reading.created_at)}</time>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
