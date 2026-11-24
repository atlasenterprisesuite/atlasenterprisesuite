import { useState } from 'react';
import {
  assessGameLaunchHandoff,
  buildGameLaunchIdeaPack,
  type GameLaunchIdea,
  type GameLaunchLanguage
} from '../../../../../../packages/creator/game_launch';

type Props = {
  onChoose: (idea: GameLaunchIdea, gameName: string, language: GameLaunchLanguage) => void;
};

// This display is NOT an authorization service. Actual release gates belong
// to the identity-aware Creator/Publisher backends and human review.
const UNVERIFIED = assessGameLaunchHandoff({
  identityVerified: false,
  tenantVerified: false,
  publisherPermissionVerified: false,
  sourceChecked: false,
  originalFootage: false,
  commercialRightsVerified: false,
  claimsVerified: false,
  captionsReady: false,
  transcriptReady: false,
  humanApproved: false,
  evidenceDigest: null
});

export function GameLaunchPlannerPanel({ onChoose }: Props) {
  const [gameName, setGameName] = useState('GTA 6');
  const [language, setLanguage] = useState<GameLaunchLanguage>('es');
  const [ideas, setIdeas] = useState<GameLaunchIdea[]>(() => buildGameLaunchIdeaPack({
    gameName: 'GTA 6',
    language: 'es'
  }));
  const [selectedId, setSelectedId] = useState('launch-game-01');
  const [error, setError] = useState('');

  const selected = ideas.find(item => item.id === selectedId) || null;

  function regenerate() {
    try {
      const next = buildGameLaunchIdeaPack({ gameName, language });
      setIdeas(next);
      setSelectedId(next[0]?.id || '');
      setError('');
    } catch {
      setError(language === 'es'
        ? 'Indica un nombre de juego válido de 2 a 20 caracteres.'
        : 'Enter a valid game name between 2 and 20 characters.');
    }
  }

  return <section className="game-launch-planner" aria-labelledby="game-launch-title">
    <div className="content-section-heading">
      <div>
        <p className="eyebrow">ATLAS 777 · Content Intelligence · Reusable game launch</p>
        <h3 id="game-launch-title">Game Launch Editorial Planner</h3>
      </div>
      <span>Planning only · Publication gate: {UNVERIFIED.status}</span>
    </div>

    <p>These 30 editorial hypotheses (10 for the first 48 hours and 20 evergreen)
      are original topic starters, not measured trends, verified gameplay facts,
      guaranteed earnings, or proof of YouTube monetization.</p>

    <div className="content-form-grid">
      <label>
        <span>Game / videojuego</span>
        <input value={gameName} onChange={event => setGameName(event.target.value)}
          maxLength={20} aria-describedby="game-launch-help" />
      </label>
      <label>
        <span>Language / idioma</span>
        <select value={language} onChange={event => setLanguage(event.target.value as GameLaunchLanguage)}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
    <p id="game-launch-help">No external service is called. Your entries are not published or sent to NexLev.</p>
    <button type="button" className="creator-secondary" onClick={regenerate}>Generate 30 editorial prompts</button>
    {error && <p role="alert">{error}</p>}

    <ol className="game-launch-idea-list" aria-label="Provisional video ideas">
      {ideas.map(idea => <li key={idea.id}>
        <button type="button" className={selectedId === idea.id ? 'selected' : ''}
          aria-pressed={selectedId === idea.id} onClick={() => setSelectedId(idea.id)}>
          <strong>{idea.title}</strong>
          <small>{idea.window === 'launch-48h' ? 'First 48 hours' : 'Evergreen'} · {idea.format}
            {' · '}Unverified · No views inferred</small>
        </button>
      </li>)}
    </ol>

    {selected && <div className="game-launch-selected" aria-live="polite">
      <strong>{selected.title}</strong>
      <p>Thumbnail: {selected.thumbnail}</p>
      <p>Evidence / capture plan: {selected.capturePlan}</p>
      <button type="button" className="creator-primary"
        onClick={() => onChoose(selected, gameName.trim(), language)}>
        Develop with existing Hooks &amp; Content Builder
      </button>
    </div>}

    <p role="status">Review boundary: {UNVERIFIED.status}. Source attribution, original
      footage, commercial permissions, factual verification, captions, transcript,
      tenant permissions, and human review are not yet proven. This panel cannot
      authorize a render, charge, upload, schedule, or publish action.</p>
  </section>;
}
