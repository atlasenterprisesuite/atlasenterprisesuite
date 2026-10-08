import { type CSSProperties, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ATLAS_MODULES } from '../modules/registry';
import { AtlasVisualReference } from './AtlasVisualReference';
import './futuristic-enterprise-home.css';
import './atlas-visual-home.css';

const readinessLabel = {
  implemented: 'Implementado (sin certificación)',
  partial: 'En evolución',
  'external-gated': 'Conexión requerida'
} as const;

type PrimarySurfaceDefinition = {
  name: string;
  eyebrow: string;
  moduleId?: string;
  path?: string;
};

const primarySurfaceDefinitions: readonly PrimarySurfaceDefinition[] = [
  { name: 'AI', eyebrow: 'Intelligence', moduleId: 'assistant' },
  { name: 'Enterprise', eyebrow: 'Operations', path: '/suite' },
  { name: 'Finance', eyebrow: 'Capital', moduleId: 'finance' },
  { name: 'Network', eyebrow: 'Connections', moduleId: 'connect' },
  { name: 'Spatial', eyebrow: 'Spatial', moduleId: 'galaxy' },
  { name: 'Health', eyebrow: 'Health OS', moduleId: 'health' },
  { name: 'Business', eyebrow: 'Growth', moduleId: 'business' },
  { name: 'Creator', eyebrow: 'Studio', moduleId: 'studio' },
  { name: 'Cloud', eyebrow: 'Platform', moduleId: 'cloud' }
] as const;

const primarySurfaces = primarySurfaceDefinitions.flatMap((surface) => {
  if (surface.path) return [{ ...surface, path: surface.path }];
  const module = ATLAS_MODULES.find((candidate) => candidate.id === surface.moduleId);
  return module ? [{ ...surface, path: module.route }] : [];
});

const quickLinks = primarySurfaces.slice(0, 5);

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

// A catalog count ratio, not a production certification score. The catalog
// readiness and evolution axes are deliberately independent.
export function getAtlasCatalogShare(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}

export function FuturisticEnterpriseHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const implemented = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').length;
  const activeEvolution = ATLAS_MODULES.filter((module) => module.evolution === 'active').length;
  const gated = ATLAS_MODULES.filter((module) => module.readiness === 'external-gated').length;
  const total = ATLAS_MODULES.length;
  const featured = ATLAS_MODULES.filter((module) => module.showInNavigation).slice(0, 8);
  const operational = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').slice(0, 5);
  const recentModules = featured.slice(0, 4);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeSearch(query);
    if (!normalized) {
      setSearchMessage('Escribe un módulo o función para continuar.');
      return;
    }

    const exactMatch = ATLAS_MODULES.find((module) =>
      [module.id, module.title, module.navLabel, module.area]
        .some((field) => field.toLocaleLowerCase() === normalized)
    );
    const match = exactMatch ?? ATLAS_MODULES.find((module) =>
      [module.id, module.title, module.navLabel, module.area, module.description]
        .some((field) => field.toLocaleLowerCase().includes(normalized))
    );

    if (!match) {
      setSearchMessage(`No se encontró “${query.trim()}” en el catálogo actual.`);
      return;
    }

    setSearchMessage('');
    navigate(match.route);
  };

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
    <>
      <section className="atlas-visual-home" aria-label="ATLAS Enterprise Suite visual home">
        <div className="atlas-visual-home__backdrop" aria-hidden="true" />
        <img
          className="atlas-visual-home__image"
          src="/assets/atlas-home-sunset.jpeg"
          alt=""
          aria-hidden="true"
        />
        <div className="atlas-visual-home__veil" aria-hidden="true" />

        <nav className="atlas-visual-home__nav" aria-label="Accesos principales de ATLAS">
          <Link className="atlas-visual-home__brand" to="/" aria-label="ATLAS Home">
            <span className="atlas-visual-home__brand-mark" aria-hidden="true">A</span>
            <span>ATLAS</span>
          </Link>
          <div className="atlas-visual-home__quick-links">
            {quickLinks.map((item) => (
              <Link key={item.name} to={item.path} aria-label={item.name}>
                <small>{item.eyebrow}</small>
                <strong>{item.name}</strong>
              </Link>
            ))}
          </div>
        </nav>

        <div className="atlas-visual-home__content">
          <p className="atlas-visual-home__eyebrow">ONE GOVERNED ENTERPRISE ECOSYSTEM</p>
          <h1>ATLAS Enterprise Suite</h1>
          <p className="atlas-visual-home__lede">
            Personas, procesos, datos e inteligencia conectados desde una sola superficie operativa.
          </p>

          <form className="atlas-visual-home__search" aria-label="ATLAS command search" onSubmit={handleSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Buscar en ATLAS"
              placeholder="Buscar módulo, función o comando…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit">Buscar</button>
          </form>
          <p className="atlas-visual-home__search-status" role="status" aria-live="polite">{searchMessage}</p>

          <nav className="atlas-home-surfaces" aria-label="ATLAS primary surfaces">
            {primarySurfaces.map((surface) => (
              <Link
                key={surface.name}
                className="atlas-home-surface-card"
                to={surface.path}
                aria-label={`${surface.name} surface`}
              >
                <small>{surface.eyebrow}</small>
                <strong>{surface.name}</strong>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </nav>

          <div className="atlas-home-status" aria-label="ATLAS system status">
            <span className="atlas-home-status__label">SYSTEM</span>
            <strong>{implemented} implementados</strong>
            <span aria-hidden="true">·</span>
            <strong>{activeEvolution} en evolución</strong>
            <span aria-hidden="true">·</span>
            <strong>{gated} conexiones</strong>
            <span>Estado derivado del catálogo canónico</span>
          </div>

          <div className="atlas-visual-home__recent" aria-label="Módulos recientes">
            <span>RECIENTES</span>
            {recentModules.map((module) => (
              <Link key={module.id} to={module.route}>{module.navLabel}</Link>
            ))}
          </div>
        </div>

        <a className="atlas-visual-home__enter" href="#atlas-command-center">
          <span>Abrir Command Center</span>
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section id="atlas-command-center" className="atlas-command-home" aria-label="ATLAS Command Center">
        <div className="atlas-spatial-hint atlas-spatial-hint-top" aria-hidden="true">
          <span>⌃</span> Desliza arriba · más módulos
        </div>

        <section className="atlas-hero-command">
          <div className="atlas-hero-copy">
            <div className="atlas-core-orb" aria-hidden="true"><span>ATLAS</span></div>
            <p className="atlas-command-eyebrow">ATLAS COMMAND CENTER</p>
            <h2 id="atlas-command-title" aria-label="One governed enterprise ecosystem">Bienvenido a <span>ATLAS</span></h2>
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
            <p className="atlas-contract-narrative">One operating system for governed enterprise work.</p>
            <p className="atlas-system-note">Orlando · Personas · Procesos · Datos · Resultados</p>
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

        <section className="atlas-original-designs" aria-labelledby="atlas-original-designs-title">
          <header>
            <div>
              <p className="atlas-command-eyebrow">DISEÑO CANÓNICO · BIBLIOTECA ATLAS</p>
              <h2 id="atlas-original-designs-title">Los diseños originales ahora viven dentro del producto</h2>
            </div>
            <p>Estas referencias aprobadas gobiernan la composición visual de Dashboard, Universe, módulos y Voice. Cada una abre la superficie funcional correspondiente.</p>
          </header>
          <div className="atlas-original-design-grid">
            <AtlasVisualReference reference="dashboard" compact />
            <AtlasVisualReference reference="universe" compact />
            <AtlasVisualReference reference="modules" compact />
            <AtlasVisualReference reference="voice" compact />
          </div>
        </section>

        <section className="atlas-command-metrics" aria-label="ATLAS module readiness summary">
          <article><span className="metric-icon">◇</span><small>MÓDULOS</small><strong>{total}</strong><p>Registrados en el catálogo ATLAS</p></article>
          <article><span className="metric-icon">✓</span><small>IMPLEMENTADOS</small><strong>{implemented}</strong><p>Cobertura de código en el catálogo; no es certificación de producción</p></article>
          <article><span className="metric-icon">↗</span><small>EN EVOLUCIÓN</small><strong>{activeEvolution}</strong><p>Siguiente versión en desarrollo o validación</p></article>
          <article><span className="metric-icon">◎</span><small>CONEXIONES</small><strong>{gated}</strong><p>Dependencias externas gobernadas</p></article>
        </section>

        <section className="atlas-command-lower">
          <article className="atlas-system-panel">
            <header>
              <div><strong>Resumen general del sistema</strong><span>Estados independientes derivados del catálogo canónico</span></div>
              <Link to="/suite">Ver módulos →</Link>
            </header>
            <div
              className="atlas-readiness-chart"
              role="img"
              aria-label={`Distribución del catálogo: ${implemented} módulos implementados, ${activeEvolution} en evolución activa y ${gated} con dependencia externa; no es certificación de producción`}
            >
              <div className="chart-grid" aria-hidden="true" />
              <div className="chart-bars">
                <div><span style={{ height: `${getAtlasCatalogShare(implemented, total)}%` }} /><small>${implemented} implementados</small></div>
                <div><span style={{ height: `${getAtlasCatalogShare(activeEvolution, total)}%` }} /><small>${activeEvolution} en evolución</small></div>
                <div><span style={{ height: `${getAtlasCatalogShare(gated, total)}%` }} /><small>${gated} externos</small></div>
              </div>
            </div>
            <p className="atlas-chart-note">Los estados pueden superponerse; no representan certificación de producción.</p>
            <p className="atlas-chart-certification">Porcentaje de certificación: sin evidencia suficiente</p>
          </article>

          <article className="atlas-system-panel atlas-operational-feed">
            <header>
              <div><strong>Capacidades con código registrado</strong><span>Derivadas del registro canónico, no de pruebas de producción</span></div>
              <span className="live-chip"><i /> CATÁLOGO</span>
            </header>
            <div className="atlas-operation-list">
              {operational.map((module) => (
                <Link key={module.id} to={module.route}>
                  <span className="operation-mark" aria-hidden="true">•</span>
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
    </>
  );
}
