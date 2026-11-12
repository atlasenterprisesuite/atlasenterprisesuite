import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EARTH_EXPLORATION_SOURCES,
  buildGebcoMapUrl,
  type GebcoLayer,
  type GebcoRegion
} from './earthExplorationSources';
import './earth-exploration.css';

const LAYER_LABELS: Record<GebcoLayer, string> = {
  surface: 'Relieve y superficie del hielo',
  subice: 'Relieve submarino y bajo el hielo',
  tid: 'Tipo de datos: TID'
};
const REGION_LABELS: Record<GebcoRegion, string> = {
  world: 'Mundo',
  antarctica: 'Antártida y océano Austral',
  atlantic: 'Océano Atlántico'
};

export function EarthExplorationPage() {
  const [layer, setLayer] = useState<GebcoLayer>('subice');
  const [region, setRegion] = useState<GebcoRegion>('antarctica');
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const mapUrl = useMemo(() => buildGebcoMapUrl(layer, region), [layer, region]);
  const changeLayer = (value: GebcoLayer) => { setImageState('loading'); setLayer(value); };
  const changeRegion = (value: GebcoRegion) => { setImageState('loading'); setRegion(value); };

  return (
    <section className="page-stack atlas-earth" aria-labelledby="atlas-earth-heading">
      <header className="page-header">
        <p className="eyebrow">ATLAS Knowledge · Earth Exploration Intelligence</p>
        <h1 id="atlas-earth-heading">Antártida y océanos: datos científicos verificables</h1>
        <p>
          Consulta cartografía pública de instituciones científicas; distingue relieve observado,
          superficies interpoladas y teorías no demostradas. Las imágenes WMS son servidas por GEBCO,
          no se almacenan como mediciones de ATLAS.
        </p>
        <Link to="/knowledge">Volver a Knowledge Atlas</Link>
      </header>

      <div className="notice strong" role="note">
        Frontera de evidencia: los mapas geofísicos no prueban la presencia de ciudades,
        restos arqueológicos ni la ubicación de la Atlántida. Ningún instrumento está conectado
        ni se afirma haber descargado o procesado los rásteres originales.
      </div>

      <section className="atlas-earth-map-panel workspace-card" aria-labelledby="atlas-earth-map-heading">
        <div>
          <p className="eyebrow">GEBCO_2026 · WMS público</p>
          <h2 id="atlas-earth-map-heading">Mapa científico remoto</h2>
          <p>Comparación entre superficie, topografía bajo el hielo y procedencia de los datos.</p>
          <p className="muted">
            Procedencia: la versión subglacial GEBCO_2026 utiliza BedMachine Antarctica v3;
            Bedmap3 es un conjunto independiente registrado por ATLAS, todavía no fusionado
            con el visor. La capa TID identifica categorías de origen, no ruinas ni certidumbre arqueológica.
          </p>
        </div>
        <div className="atlas-earth-controls">
          <label htmlFor="atlas-earth-layer">
            Capa geográfica
            <select id="atlas-earth-layer" value={layer} onChange={event => changeLayer(event.target.value as GebcoLayer)}>
              {Object.entries(LAYER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label htmlFor="atlas-earth-region">
            Región
            <select id="atlas-earth-region" value={region} onChange={event => changeRegion(event.target.value as GebcoRegion)}>
              {Object.entries(REGION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        {imageState === 'loading' ? <p role="status" aria-live="polite">Solicitando imagen cartográfica al servicio oficial…</p> : null}
        {imageState === 'ready' ? <p role="status" aria-live="polite">Imagen recibida del servidor GEBCO; no implica validación arqueológica.</p> : null}
        {imageState === 'error' ? (
          <div className="work-error" role="alert">
            No se pudo cargar el WMS externo. No se muestran datos simulados;
            puedes consultar el servicio oficial en el enlace de procedencia.
          </div>
        ) : null}
        <div className="atlas-earth-map-frame">
          <img
            key={mapUrl}
            src={mapUrl}
            alt={`Imagen cartográfica GEBCO_2026: ${LAYER_LABELS[layer]}, región ${REGION_LABELS[region]}`}
            loading="lazy"
            onLoad={() => setImageState('ready')}
            onError={() => setImageState('error')}
            style={imageState === 'error' ? { display: 'none' } : undefined}
          />
        </div>
        <p className="atlas-earth-attribution">
          GEBCO Bathymetric Compilation Group 2026 · DOI:
          {' '}<a href="https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa" target="_blank" rel="noopener noreferrer">10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa</a>.
          Este producto no debe utilizarse para navegación ni seguridad marítima.
        </p>
      </section>

      <section className="atlas-earth-sources" aria-labelledby="atlas-earth-sources-heading">
        <h2 id="atlas-earth-sources-heading">Registro de fuentes y calidad</h2>
        <div className="atlas-earth-source-grid">
          {EARTH_EXPLORATION_SOURCES.map(source => (
            <article className="workspace-card" key={source.id}>
              <p className="eyebrow">{source.institution} · {source.year}</p>
              <h3>{source.title}</h3>
              <p>{source.nativeResolution}</p>
              <strong>Datos disponibles</strong>
              <p>{source.availableLayers.join(' · ')}</p>
              <strong>Incertidumbre y límites</strong>
              <p>{source.explainsUncertainty}</p>
              <div className="atlas-earth-source-links">
                <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">Ficha oficial</a>
                <a href={source.browseUrl} target="_blank" rel="noopener noreferrer">Explorar fuente</a>
                <a href={source.doi} target="_blank" rel="noopener noreferrer">DOI de datos</a>
              </div>
              <small>{source.attribution}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="notice">
        Estado de integración: catálogo con procedencia oficial y visualización WMS de solo lectura.
        La descarga de grillas Bedmap3/GEBCO, la fusión geoespacial 3D y el análisis de anomalías
        siguen pendientes de un pipeline reproducible, almacenamiento y validación de incertidumbre.
      </div>
    </section>
  );
}
