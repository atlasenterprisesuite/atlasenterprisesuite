import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getOracleReading,
  saveOracleNote,
  setOracleFavorite,
  type OracleCardRecord,
  type OracleReadingDetail
} from '../../lib/oracleApi';

function relatedCard(value: OracleCardRecord | OracleCardRecord[] | undefined): OracleCardRecord | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function OracleReadingPage() {
  const { readingId = '' } = useParams();
  const [data, setData] = useState<OracleReadingDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getOracleReading(readingId)
      .then((result) => {
        if (!active) return;
        setData(result);
        setNote(result.note?.note || '');
        setFavoriteIds(new Set((result.favorites || []).map((item) => item.card_id)));
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [readingId, attempt]);

  const cards = useMemo(() => {
    if (!data) return [];
    if (data.cards?.length) {
      return [...data.cards]
        .sort((a, b) => a.sequence - b.sequence)
        .map((entry) => ({
          id: entry.card_id,
          position: entry.spread_position,
          card: relatedCard(entry.oracle_cards)
        }));
    }
    return (data.selected_cards || []).map((card, index) => ({
      id: card.id,
      position: data.interpretation?.[index]?.position.key || `position-${index + 1}`,
      card: {
        id: card.id,
        slug: card.slug,
        title: card.title,
        short_message: card.shortMessage,
        long_message: card.longMessage,
        category: card.category
      } as OracleCardRecord
    }));
  }, [data]);

  async function handleSaveNote() {
    if (!data || noteState === 'saving') return;
    setNoteState('saving');
    try {
      await saveOracleNote(data.reading.id, note);
      setNoteState('saved');
    } catch {
      setNoteState('error');
    }
  }

  async function toggleFavorite(cardId: string) {
    if (favoriteBusy) return;
    const next = !favoriteIds.has(cardId);
    setFavoriteBusy(cardId);
    try {
      await setOracleFavorite(cardId, next);
      setFavoriteIds((current) => {
        const updated = new Set(current);
        if (next) updated.add(cardId);
        else updated.delete(cardId);
        return updated;
      });
    } finally {
      setFavoriteBusy(null);
    }
  }

  if (status === 'loading') return <div className="oracle-empty" role="status">Opening your private reading…</div>;
  if (status === 'error' || !data) {
    return (
      <div className="oracle-empty" role="alert">
        <strong>This private reading could not be opened.</strong>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="oracle-page">
      <header className="oracle-page-header oracle-reading-header">
        <p className="oracle-kicker">{data.reading.reading_type} · Owner-only history</p>
        <h1>Your private reading</h1>
        <p>{formatDate(data.reading.created_at)}</p>
        {data.reading.prompt_context ? <blockquote>{data.reading.prompt_context}</blockquote> : null}
      </header>

      <div className="oracle-disclaimer" role="note">
        <strong>Symbolic reflection</strong>
        <span>{data.disclaimer || 'This reading is symbolic reflection, not a guaranteed prediction or medical, financial, or legal advice.'}</span>
      </div>

      <section className="oracle-spread" aria-label="Selected mystical cards">
        {cards.map(({ id, position, card }, index) => {
          const interpretation = data.interpretation?.[index];
          return (
            <article key={`${id}-${position}`} className="oracle-spread-card">
              <div className="oracle-card-number">{String(index + 1).padStart(2, '0')}</div>
              <div className="oracle-card-art compact" aria-hidden="true"><span>☾</span><i>✦</i></div>
              <div className="oracle-spread-copy">
                <p className="oracle-kicker">{interpretation?.position.label || position.replace(/-/g, ' ')}</p>
                <h2>{card?.title || 'Verified card'}</h2>
                <p><strong>{card?.short_message}</strong></p>
                <p>{interpretation?.reflection || card?.long_message}</p>
                <button
                  type="button"
                  className="oracle-favorite-button"
                  onClick={() => void toggleFavorite(id)}
                  disabled={favoriteBusy === id}
                  aria-pressed={favoriteIds.has(id)}
                >
                  {favoriteIds.has(id) ? '★ Favorited' : '☆ Add to favorites'}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="oracle-note-panel" aria-labelledby="oracle-private-note-title">
        <div>
          <p className="oracle-kicker">Owner-only annotation</p>
          <h2 id="oracle-private-note-title">Private note</h2>
          <p>This note stays attached to this reading and is protected by owner-scoped RLS.</p>
        </div>
        <label htmlFor="oracle-private-note">Private note</label>
        <textarea
          id="oracle-private-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteState('idle');
          }}
          maxLength={12000}
        />
        <div className="oracle-note-actions">
          <button type="button" onClick={() => void handleSaveNote()} disabled={noteState === 'saving'}>Save private note</button>
          <span aria-live="polite">
            {noteState === 'saving' ? 'Saving…' : noteState === 'saved' ? 'Saved privately.' : noteState === 'error' ? 'Could not save note.' : ''}
          </span>
        </div>
      </section>

      <footer className="oracle-page-footer">
        <Link to="/assistant/oracle">← Back to private readings</Link>
        <Link to="/assistant/oracle/deck">Open verified deck →</Link>
      </footer>
    </div>
  );
}
