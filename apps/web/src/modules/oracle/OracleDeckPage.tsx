import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOracleDeck, type OracleCardRecord, type OracleDeckStatus } from '../../lib/oracleApi';

type DeckState = {
  deck: OracleDeckStatus;
  cards: OracleCardRecord[];
};

export function OracleDeckPage() {
  const [state, setState] = useState<DeckState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getOracleDeck()
      .then((result) => {
        if (!active) return;
        setState({ deck: result.deck, cards: result.cards || [] });
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === 'loading') return <div className="oracle-empty" role="status">Loading verified mystical deck…</div>;
  if (status === 'error' || !state) {
    return (
      <div className="oracle-empty" role="alert">
        <strong>The verified deck could not be loaded.</strong>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </div>
    );
  }

  const verified = state.deck.verified_card_count ?? state.cards.length;
  const expected = state.deck.expected_card_count ?? verified;

  return (
    <div className="oracle-page">
      <header className="oracle-page-header">
        <p className="oracle-kicker">Mensajes del Oráculo Místico</p>
        <h1>Mystical Deck Library</h1>
        <p>Only cards verified from the approved source appear here. ATLAS does not invent missing cards to make the deck look complete.</p>
      </header>

      <div className="oracle-deck-status" aria-label="Oracle deck completeness">
        <strong>{verified} verified of {expected}</strong>
        <span className={state.deck.is_complete ? 'complete' : 'incomplete'}>{state.deck.is_complete ? 'Deck complete' : 'Deck incomplete'}</span>
      </div>

      <div className="oracle-card-grid">
        {state.cards.map((card) => (
          <article key={card.id} className="oracle-deck-card">
            <div className="oracle-card-art" aria-hidden="true">
              <span>☾</span><i>✦</i>
            </div>
            <div>
              <p className="oracle-kicker">{card.category.replace(/-/g, ' ')}</p>
              <h2>{card.title}</h2>
              <p><strong>{card.short_message}</strong></p>
              <p>{card.long_message}</p>
            </div>
          </article>
        ))}
      </div>

      <footer className="oracle-page-footer">
        <Link to="/assistant/oracle">← Back to private readings</Link>
        {!state.deck.is_complete ? <span>37 card definitions remain unverified and are intentionally unavailable.</span> : null}
      </footer>
    </div>
  );
}
