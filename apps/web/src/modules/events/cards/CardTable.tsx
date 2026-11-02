import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createTable, playCard, tableView, type Card } from './engine';
import './cards.css';

const symbols = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const suits = { clubs: 'tréboles', diamonds: 'diamantes', hearts: 'corazones', spades: 'picas' };
function label(card: Card) {
  return `${({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[card.rank] ?? card.rank} de ${suits[card.suit]}`;
}
function face(card: Card) {
  return <><strong>{label(card).split(' ')[0]}</strong><span aria-hidden="true">{symbols[card.suit]}</span></>;
}
export function CardTable() {
  const [state, setState] = useState(() => createTable());
  const view = tableView(state);
  const [error, setError] = useState('');
  const roundResult = view.last ? view.last[0].rank === view.last[1].rank ? 'Empate: sin puntos.' : view.last[0].rank > view.last[1].rank ? 'Ganaste la ronda.' : 'El bot ganó la ronda.' : 'Elige una carta para comenzar.';
  const result = view.scores[0] === view.scores[1] ? 'Partida empatada.' : view.scores[0] > view.scores[1] ? 'Ganaste la partida.' : 'El bot ganó la partida.';
  return <section className="page-stack atlas-cards" lang="es">
    <header className="page-header"><Link to="/events">← Events & Entertainment</Link><p className="eyebrow">ATLAS · Juegos de cartas</p><h1>Carta Mayor</h1><p>Práctica local contra un bot. Sin apuestas. La partida se pierde al salir o recargar.</p></header>
    <details><summary>Cómo jugar</summary><p>Baraja de 52 cartas, cinco por mano. Selecciona una carta; el bot juega su carta más baja. La carta mayor gana un punto: 2 a 10, J, Q, K, A. Los palos no dan ventaja y los empates no puntúan. Ambos roban una carta tras cada ronda hasta agotar el mazo. Tras 26 rondas gana quien tenga más puntos.</p></details>
    <div className="atlas-card-felt">
      <p>Bot · {view.opponentCount} cartas ocultas · Mazo: {view.remaining}</p>
      <p className="atlas-card-score">Tú: {view.scores[0]} · Bot: {view.scores[1]} · Rondas: {view.round}/26</p>
      <div role="status" aria-live="polite" aria-atomic="true"><p>{view.last ? `Tú: ${label(view.last[0])}. Bot: ${label(view.last[1])}. ` : ''}{roundResult} {view.status === 'finished' ? result : ''}</p></div>
      <div className="atlas-card-reveal" aria-hidden="true">{view.last?.map((card, i) => <div className="atlas-playing-card" key={card.id}><small>{i === 0 ? 'Tú' : 'Bot'}</small>{face(card)}</div>)}</div>
      <div className="atlas-card-hand" role="group" aria-label="Tu mano">{view.hand.map(card => <button className="atlas-playing-card" key={card.id} aria-label={`Jugar ${label(card)}`} onClick={() => {
        try { setState(current => playCard(current, card.id)); setError(''); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo jugar'); }
      }}>{face(card)}<small>{suits[card.suit]}</small></button>)}</div>
    </div>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={() => { setState(createTable()); setError(''); }}>Nueva partida local</button>
    <p>Multijugador y salas privadas aún no habilitados. No se envían ni guardan partidas en el servidor.</p>
  </section>;
}
