import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_MODULES } from '../modules/registry';
import './futuristic-enterprise-home.css';

const readinessLabel = {
  implemented: 'Operativo',
  partial: 'En evolución',
  'external-gated': 'Conexión requerida'
} as const;

export function FuturisticEnterpriseHome() {
  const implemented = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').length;
  const partial = ATLAS_MODULES.filter((module) => module.readiness === 'partial').length;
  const gated = ATLAS_MODULES.filter((module) => module.readiness === 'external-gated').length;
  const total = ATLAS_MODULES.length;
  const featured = ATLAS_MODULES.filter((module) => module.showInNavigation).slice(0, 8);
  const operational = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').slice(0, 5);

  const moveSpatial = (direction: 'left' | 'right' | 'up' | 'down') => {
    const viewport = document.getElementById('atlas-spatial-module-grid');
    if (!viewport) return;
    const horizontal = Math.max(280, viewport.clientWidth * 0.72);
    const vertical = Math.max(220, viewport.clientHeight * 0.72);
    viewport.scrollBy({
      left: direction === 'left' ? -horizontal : direction === 'right' ? horizontal : 0,
      top: direction === 'up' ? -vertical : direction === 'down' ? vertical : 0,
      behavior: 'smooth'
    });
  };

  return (
    <section className="atlas-command-home" aria-labelledby="atlas-command-title">
      <div className="atlas-spatial-hint atlas-spatial-hint-top" aria-hidden="true">
        <span>⌃</span> Desliza arriba · más módulos
      </div>

      <section className="atlas-hero-command">
        <div className="atlas-hero-copy">
          <div className="atlas-core-orb" aria-hidden="true"><span>ATLAS</span></div>
          <p className="atlas-command-eyebrow">ORLANDO · ENTERPRISE OS</p>
          <h1 id="atlas-command-title">Bienvenido a <span>ATLAS</span></h1>
          <p className="atlas-command-lede">
            Un sistema operativo empresarial conectado. Navega por módulos, datos y flujos desde un espacio
            multidireccional diseñado para desktop, tablet y móvil.
          </p>
          <div className="atlas-command-actions">
            <Link className="atlas-primary-action" to="/execution/manager/readiness">
              Ejecutar verificación funcional <span aria-hidden="true">→</span>
            </Link>
            <Link className="atlas-secondary-action" to="/suite">Explorar todos los módulos</Link>
          </div>
          <p className="atlas-system-note">Personas · Procesos · Datos · Resultados</p>
        </div>

        <div className="atlas-globe-stage" aria-label="ATLAS global enterprise network">
          <div className="atlas-globe-orbit orbit-one" />
          <div className="atlas-globe-orbit orbit-two" />
          <div className="atlas-globe">
            <span className="atlas-globe-latitude lat-one" />
            <span className="atlas-globe-latitude lat-two" />
            <span className="atlas-globe-longitude long-one" />
            <span className="atlas-globe-longitude long-two" />
            <strong>ATLAS</strong>
          </div>
          <div className="atlas-control-copy">
            <span>PERSONAS</span><span>PROCESOS</span><span>DATOS</span><span>RESULTADOS</span>
            <strong>CONTROL<br />SIN LÍMITES</strong>
          </div>
        </div>
      </section>

      <section className="atlas-command-metrics" aria-label="ATLAS module readiness summary">
        <article><span className="metric-icon">◇</span><small>MÓDULOS</small><strong>{total}</strong><p>Registrados en el catálogo ATLAS</p></article>
        <article><span className="metric-icon">✓</span><small>OPERATIVOS</small><strong>{implemented}</strong><p>Implementación marcada como operativa</p></article>
        <article><span className="metric-icon">↗</span><small>EN EVOLUCIÓN</small><strong>{partial}</strong><p>Capacidades parciales con límites visibles</p></article>
        <article><span className="metric-icon">◎</span><small>CONEXIONES</small><strong>{gated}</strong><p>Dependencias externas gobernadas</p></article>
      </section>

      <section className="atlas-command-lower">
        <article className="atlas-system-panel">
          <header>
            <div><strong>Resumen general del sistema</strong><span>Estado real del catálogo de módulos</span></div>
            <Link to="/suite">Ver módulos →</Link>
          </header>
          <div className="atlas-readiness-chart" role="img" aria-label={`${implemented} módulos operativos, ${partial} parciales y ${gated} con conexión externa requerida`}>
            <div className="chart-grid" aria-hidden="true" />
            <div className="chart-bars">
              <div><span style={{ height: `${Math.max(18, (implemented / total) * 100)}%` }} /><small>Operativos</small></div>
              <div><span style={{ height: `${Math.max(18, (partial / total) * 100)}%` }} /><small>En evolución</small></div>
              <div><span style={{ height: `${Math.max(18, (gated / total) * 100)}%` }} /><small>Conexión</small></div>
            </div>
          </div>
        </article>

        <article className="atlas-system-panel atlas-operational-feed">
          <header>
            <div><strong>Capacidades operativas</strong><span>Derivadas del registro canónico</span></div>
            <span className="live-chip"><i /> CATÁLOGO</span>
          </header>
          <div className="atlas-operation-list">
            {operational.map((module) => (
              <Link key={module.id} to={module.route}>
                <span className="operation-mark">✓</span>
                <span><strong>{module.title}</strong><small>{module.area} · {module.description}</small></span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="atlas-spatial-section" aria-labelledby="atlas-spatial-title">
        <header className="atlas-spatial-header">
          <div><p className="atlas-command-eyebrow">VISTA ESPACIAL</p><h2 id="atlas-spatial-title">Desliza en cualquier dirección</h2></div>
          <p>Arrastra con touch o trackpad y usa los controles para recorrer el ecosistema ATLAS.</p>
        </header>

        <div className="atlas-spatial-shell">
          <button type="button" className="spatial-arrow spatial-up" onClick={() => moveSpatial('up')} aria-label="Deslizar módulos hacia arriba">↑</button>
          <button type="button" className="spatial-arrow spatial-left" onClick={() => moveSpatial('left')} aria-label="Deslizar módulos hacia la izquierda">←</button>
          <div
            id="atlas-spatial-module-grid"
            className="atlas-spatial-viewport"
            tabIndex={0}
            aria-label="Módulos ATLAS en navegación multidireccional"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') moveSpatial('left');
              if (event.key === 'ArrowRight') moveSpatial('right');
              if (event.key === 'ArrowUp') moveSpatial('up');
              if (event.key === 'ArrowDown') moveSpatial('down');
            }}
          >
            <div className="atlas-spatial-grid">
              {ATLAS_MODULES.map((module, index) => (
                <Link
                  key={module.id}
                  className={`atlas-spatial-module readiness-${module.readiness}`}
                  to={module.route}
                  style={{ '--module-index': index } as CSSProperties}
                >
                  <span className="atlas-module-symbol" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <small>{module.area}</small>
                  <strong>{module.title}</strong>
                  <p>{module.description}</p>
                  <span className="atlas-readiness-chip">{readinessLabel[module.readiness]}</span>
                </Link>
              ))}
            </div>
          </div>
          <button type="button" className="spatial-arrow spatial-right" onClick={() => moveSpatial('right')} aria-label="Deslizar módulos hacia la derecha">→</button>
          <button type="button" className="spatial-arrow spatial-down" onClick={() => moveSpatial('down')} aria-label="Deslizar módulos hacia abajo">↓</button>
        </div>
      </section>

      <section className="atlas-recent-strip" aria-label="Módulos destacados">
        <span className="atlas-recent-label">MÓDULOS DESTACADOS</span>
        <div className="atlas-recent-scroller">
          {featured.map((module) => (
            <Link key={module.id} to={module.route}><span>{module.area}</span><strong>{module.navLabel}</strong></Link>
          ))}
        </div>
      </section>

      <div className="atlas-spatial-hint atlas-spatial-hint-bottom" aria-hidden="true">
        <span>⌄</span> Desliza abajo · más información
      </div>
    </section>
  );
}
