import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_FLOURISHING_MODE, FLOURISHING_DIMENSIONS, reflectionForMode, type FlourishingMode } from './humanFlourishing';

/** Presentation-only: no storage, requests, analytics or sensitive journal fields. */
export function HumanFlourishingPage() {
  const [mode, setMode] = useState<FlourishingMode>(DEFAULT_FLOURISHING_MODE);
  const [selected, setSelected] = useState<string | null>(null);
  const reflection = reflectionForMode(mode);
  return (
    <section className="page-stack" aria-labelledby="flourishing-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS 777 · Bienestar integral</p>
        <h1 id="flourishing-title">Panel de Vida Integral</h1>
        <p>Siete dimensiones para explorar libremente. Sin puntuaciones, perfiles personales ni almacenamiento.</p>
      </header>
      <section className="workspace-card" aria-labelledby="flourishing-mode-title">
        <h2 id="flourishing-mode-title">Tu modo de reflexión</h2>
        <p>La reflexión secular está seleccionada inicialmente. El contenido cristiano aparece únicamente si lo eliges.</p>
        <div role="group" aria-label="Preferencia de reflexión">
          <button type="button" aria-pressed={mode === 'secular'} onClick={() => setMode('secular')}>Secular</button>
          <button type="button" aria-pressed={mode === 'christian'} onClick={() => setMode('christian')}>Cristiana (opcional)</button>
        </div>
        <article aria-live="polite" aria-atomic="true">
          <h3>{reflection.title}</h3>
          <p>{reflection.body}</p>
          <small>Fuente: {reflection.source}</small>
        </article>
      </section>
      <section aria-labelledby="flourishing-dimensions-title">
        <h2 id="flourishing-dimensions-title">Tus siete dimensiones</h2>
        <div className="module-grid">
          {FLOURISHING_DIMENSIONS.map((dimension) => (
            <article className="module-card" key={dimension.id}>
              <h3>{dimension.title}</h3>
              <p>{dimension.description}</p>
              <button type="button" aria-expanded={selected === dimension.id} aria-controls={`flourishing-action-${dimension.id}`} onClick={() => setSelected((current) => current === dimension.id ? null : dimension.id)}>
                {selected === dimension.id ? 'Ocultar sugerencia' : 'Ver una sugerencia'}
              </button>
              {selected === dimension.id && <p id={`flourishing-action-${dimension.id}`}>{dimension.action}</p>}
              <p><Link to={dimension.route}>Explorar módulo relacionado</Link></p>
            </article>
          ))}
        </div>
      </section>
      <p role="note">Las sugerencias son voluntarias. ATLAS no infiere creencias, diagnósticos ni resultados; este panel no guarda respuestas.</p>
    </section>
  );
}
