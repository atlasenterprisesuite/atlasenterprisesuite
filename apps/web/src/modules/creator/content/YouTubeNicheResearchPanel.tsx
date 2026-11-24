import { useState } from 'react';
import {
  YOUTUBE_NICHE_VIDEO_2027,
  YOUTUBE_NICHES_2027,
  assessYouTubeNicheEvidence,
  youtubeNicheVideoUrl,
  type YouTubeNiche2027,
  type YouTubeNicheEvidence
} from '../../../../../../packages/creator/youtube_niches_2027';
import './youtube-niche-research.css';

const CHECKS: ReadonlyArray<{ key: keyof YouTubeNicheEvidence; label: string }> = [
  { key: 'credibleSourcesChecked', label: 'Fuentes contrastadas' },
  { key: 'rightsChecked', label: 'Derechos y licencias revisados' },
  { key: 'originalContributionChecked', label: 'Aporte creativo original comprobado' },
  { key: 'syntheticMediaDisclosureReviewed', label: 'Revisada la declaración de material sintético' },
  { key: 'humanEditorialReview', label: 'Revisión editorial humana realizada' }
];

type Props = {
  onUseNiche: (niche: YouTubeNiche2027) => void;
};

export function YouTubeNicheResearchPanel({ onUseNiche }: Props) {
  const [selectedId, setSelectedId] = useState(YOUTUBE_NICHES_2027[0].id);
  const [filter, setFilter] = useState('');
  const [checks, setChecks] = useState<YouTubeNicheEvidence>({});
  const selected = YOUTUBE_NICHES_2027.find(item => item.id === selectedId) || YOUTUBE_NICHES_2027[0];
  const visible = YOUTUBE_NICHES_2027.filter(item => (
    (item.title + ' ' + item.angle + ' ' + item.targetAudience)
      .toLocaleLowerCase('es').includes(filter.trim().toLocaleLowerCase('es'))
  ));
  const preflight = assessYouTubeNicheEvidence(checks);

  function selectNiche(niche: YouTubeNiche2027) {
    setSelectedId(niche.id);
    setChecks({});
  }

  return <section className="youtube-niche-research" aria-labelledby="youtube-niche-heading">
    <header className="youtube-niche-research-heading">
      <div>
        <p className="eyebrow">ATLAS 777 · Investigación editorial</p>
        <h2 id="youtube-niche-heading">Explorador de 10 nichos para YouTube</h2>
        <p>Temas derivados de un video de referencia. Las cifras, promesas comerciales y supuestos de monetización del autor no se han verificado de forma independiente.</p>
      </div>
      <a href={'https://www.youtube.com/watch?v=' + YOUTUBE_NICHE_VIDEO_2027.videoId}
        target="_blank" rel="noopener noreferrer" className="youtube-niche-source">
        Ver video original
      </a>
    </header>

    <div className="youtube-niche-research-layout">
      <div className="youtube-niche-choices">
        <label htmlFor="youtube-niche-search">Buscar entre los diez temas</label>
        <input id="youtube-niche-search" type="search" value={filter}
          onChange={event => setFilter(event.target.value)} placeholder="Ciencia, historia, negocios..." />
        <div className="youtube-niche-choice-list">
          {visible.map(niche => <button
            type="button" key={niche.id} aria-pressed={selected.id === niche.id}
            className={selected.id === niche.id ? 'youtube-niche-choice selected' : 'youtube-niche-choice'}
            onClick={() => selectNiche(niche)}
          >
            <span>{String(YOUTUBE_NICHES_2027.indexOf(niche) + 1).padStart(2, '0')}</span>
            <strong>{niche.title}</strong>
          </button>)}
          {visible.length === 0 && <p role="status">No hay temas que coincidan con la búsqueda.</p>}
        </div>
      </div>

      <article className="youtube-niche-detail">
        <div className="youtube-niche-detail-title">
          <div><small>Referencia editorial, no predicción financiera</small><h3>{selected.title}</h3></div>
          <a href={youtubeNicheVideoUrl(selected)} target="_blank" rel="noopener noreferrer">
            Ver momento {Math.floor(selected.startSeconds / 60)}:{String(selected.startSeconds % 60).padStart(2, '0')}
          </a>
        </div>
        <p><strong>Idea que aparece en el video:</strong> {selected.angle}</p>
        <p><strong>Enfoque original de ATLAS:</strong> {selected.originalAngle}</p>
        <p><strong>Episodio inicial propuesto:</strong> {selected.originalEpisode}</p>
        <p><strong>Investigación requerida:</strong> {selected.researchRequirement}</p>
        <p><strong>Precaución:</strong> {selected.editorialCaution}</p>
        <button type="button" className="creator-primary" onClick={() => onUseNiche(selected)}>
          Usar este nicho en Content Intelligence
        </button>
        <fieldset className="youtube-niche-evidence">
          <legend>Autoevaluación previa — no autoriza publicar</legend>
          {CHECKS.map(item => <label key={item.key}>
            <input type="checkbox" checked={checks[item.key] === true}
              onChange={event => setChecks(current => ({ ...current, [item.key]: event.target.checked }))} />
            <span>{item.label}</span>
          </label>)}
        </fieldset>
        <p role="status" className="youtube-niche-preflight">
          <strong>{preflight.status}</strong> · {preflight.blockers.length
            ? preflight.blockers.join('; ')
            : 'Los controles marcados solo son declaraciones locales. Falta comprobación de servidor, identidad, permisos y aprobación para publicar.'}
        </p>
        <p className="youtube-niche-policy-note">
          El flujo existente de ATLAS Studio conserva los permisos de identidad, publicación y revisión. Esta herramienta no genera ingresos, no conecta YouTube y no publica videos automáticamente.
        </p>
      </article>
    </div>
  </section>;
}
