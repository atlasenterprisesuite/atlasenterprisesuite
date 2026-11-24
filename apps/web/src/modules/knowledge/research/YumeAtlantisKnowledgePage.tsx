import React, { useMemo, useState } from 'react';
import {
  YUME_ATLANTIS_GRAPH,
  YUME_SOURCE_REVIEW,
  type YumeEvidenceKind,
  type YumeKnowledgeEdge
} from './yumeAtlantisGraph';

const EVIDENCE: Record<YumeEvidenceKind, string> = {
  documentado: 'Fuente atribuida',
  relato_antiguo: 'Relato antiguo',
  simbolico: 'Interpretación simbólica',
  pendiente: 'Pendiente de verificación'
};
const FILTERS: Array<YumeEvidenceKind | 'all'> = [
  'all', 'documentado', 'relato_antiguo', 'simbolico', 'pendiente'
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function EvidenceLabel({ kind }: { kind: YumeEvidenceKind }) {
  return <span className="status-pill">{EVIDENCE[kind]}</span>;
}

function SourceList({ ids }: { ids: string[] }) {
  if (!ids.length) return <p className="muted">No hay fuentes vinculadas.</p>;
  return <ul className="plain-list" aria-label="Referencias vinculadas">
    {ids.map(id => {
      const source = YUME_ATLANTIS_GRAPH.sources[id];
      if (!source) return <li key={id}>Referencia ausente: {id}</li>;
      const requiresReview = YUME_SOURCE_REVIEW[id] !== 'reference';
      return <li key={id}>
        <strong>{id}</strong>{' · '}
        {requiresReview ? (
          <span>{source.label} — enlace pendiente de comprobación</span>
        ) : (
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>
        )}
      </li>;
    })}
  </ul>;
}

/**
 * Static, source-attributed editorial atlas inside the existing authenticated Knowledge module.
 * Does not write to atlas_memory_records or imply owner-approved organizational memory.
 */
export function YumeAtlantisKnowledgePage() {
  const { nodes, edges, sources } = YUME_ATLANTIS_GRAPH;
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [evidence, setEvidence] = useState<YumeEvidenceKind | 'all'>('all');
  const [selectedId, setSelectedId] = useState('yume');

  const groups = useMemo(() => [...new Set(nodes.map(node => node.group))].sort(), [nodes]);
  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const selected = byId.get(selectedId) ?? nodes[0];

  const matching = useMemo(() => nodes.filter(node => {
    if (group && node.group !== group) return false;
    if (query.trim() && !normalize(node.label + ' ' + node.description + ' ' + node.group).includes(normalize(query.trim()))) return false;
    if (evidence !== 'all' && !edges.some(edge =>
      edge.type === evidence && (edge.source === node.id || edge.target === node.id)
    )) return false;
    return true;
  }), [nodes, edges, query, group, evidence]);

  const related = useMemo(() => edges.filter(edge =>
    (edge.source === selected.id || edge.target === selected.id) &&
    (evidence === 'all' || edge.type === evidence)
  ), [edges, selected.id, evidence]);

  const sourceIds = useMemo(() => [...new Set([
    ...selected.source_ids,
    ...related.flatMap(edge => edge.source_ids)
  ])].sort(), [related, selected]);

  const counts = useMemo(() => ({
    documentado: edges.filter(edge => edge.type === 'documentado').length,
    relato_antiguo: edges.filter(edge => edge.type === 'relato_antiguo').length,
    simbolico: edges.filter(edge => edge.type === 'simbolico').length,
    pendiente: edges.filter(edge => edge.type === 'pendiente').length
  }), [edges]);

  const selectLinked = (edge: YumeKnowledgeEdge) => {
    setSelectedId(edge.source === selected.id ? edge.target : edge.source);
  };

  return <section className="page-stack" aria-labelledby="atlas-yume-heading" lang="es">
    <header className="page-header">
      <p className="eyebrow">Knowledge Atlas · Colección de investigación · RUN 001</p>
      <h1 id="atlas-yume-heading">YUME, Atlántida y la memoria cultural</h1>
      <p>Explora nombres, obras, símbolos, fechas y relaciones mediante fuentes rastreables. El catálogo es una investigación editorial: no equivale a conocimiento organizacional aprobado.</p>
      <a href="/knowledge">Volver a Knowledge Atlas</a>
    </header>
    <div className="metric-grid" aria-label="Cobertura documental">
      <article><span>Conceptos</span><strong>{nodes.length}</strong><small>Identificadores únicos</small></article>
      <article><span>Relaciones</span><strong>{edges.length}</strong><small>{counts.documentado} atribuidas · {counts.relato_antiguo} narrativas</small></article>
      <article><span>Referencias</span><strong>{Object.keys(sources).length}</strong><small>Algunas requieren revisión</small></article>
      <article><span>Pendientes</span><strong>{counts.pendiente}</strong><small>Relaciones sin cotejo visual</small></article>
    </div>

    <section className="workspace-card" aria-label="Filtrar conceptos">
      <h2>Explorador de relaciones</h2>
      <p className="muted">Selecciona un concepto y recorre las relaciones. Los vínculos simbólicos son interpretaciones, no pruebas históricas ni mensajes autorales confirmados.</p>
      <div className="toolbar">
        <label className="field wide-field"><span>Buscar conceptos</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ej. Platón, marea, Pokinoi, YUME" />
        </label>
        <label className="field"><span>Época o categoría</span>
          <select value={group} onChange={event => setGroup(event.target.value)}>
            <option value="">Todas</option>
            {groups.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="field"><span>Tipo de evidencia</span>
          <select value={evidence} onChange={event => setEvidence(event.target.value as YumeEvidenceKind | 'all')}>
            {FILTERS.map(value => <option key={value} value={value}>{value === 'all' ? 'Todos los vínculos' : EVIDENCE[value]}</option>)}
          </select>
        </label>
      </div>
      <p className="muted" role="status" aria-live="polite">{matching.length} de {nodes.length} conceptos visibles.</p>
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem', alignItems: 'start' }}>
      <section className="workspace-card page-stack" aria-labelledby="yume-concepts-heading">
        <h2 id="yume-concepts-heading">Conceptos</h2>
        {matching.length ? <ul className="plain-list">
          {matching.map(node => <li key={node.id}>
            <button type="button" className="execution-action" aria-pressed={selected.id === node.id} onClick={() => setSelectedId(node.id)}>
              {node.label}
            </button>{' '}
            <small className="muted">{node.group}</small>
          </li>)}
        </ul> : <div className="empty-state">Sin coincidencias. Cambia la búsqueda o los filtros.</div>}
      </section>
      <section className="workspace-card page-stack" aria-labelledby="yume-detail-heading">
        <p className="eyebrow">{selected.group}</p>
        <h2 id="yume-detail-heading">{selected.label}</h2>
        <p>{selected.description}</p>
        <h3>Relaciones ({related.length})</h3>
        {related.length ? <ul className="plain-list">
          {related.map((edge, index) => {
            const adjacent = byId.get(edge.source === selected.id ? edge.target : edge.source);
            return <li key={edge.source + '-' + edge.target + '-' + index}>
              <EvidenceLabel kind={edge.type} />{' '}
              {adjacent ? <button type="button" className="execution-action" onClick={() => selectLinked(edge)} aria-label={'Explorar ' + adjacent.label}>{adjacent.label}</button> : null}
              <p>{edge.reason}</p>
              <small className="muted">Referencias: {edge.source_ids.join(', ')}</small>
            </li>;
          })}
        </ul> : <p className="muted">No hay relaciones de este tipo para el concepto seleccionado.</p>}
        <h3>Fuentes del concepto y relaciones visibles</h3>
        <SourceList ids={sourceIds} />
      </section>
    </div>
    <div className="notice strong">
      <p><strong>Protocolo 777:</strong> «Fuente atribuida» describe el respaldo documental consignado en esta investigación, no la validación independiente de cada afirmación. «Relato antiguo» significa que Platón lo narró; no confirma la existencia arqueológica de Atlántida.</p>
      <p>Los enlaces marcados para revisión no se abren automáticamente. El videoclip todavía requiere cotejo de fotogramas y autorización editorial antes de publicar conclusiones como verificadas.</p>
      <small className="muted">Fuente de datos: ATLAS YUME / Atlántida RUN 001 · {YUME_ATLANTIS_GRAPH.created_on} · solo lectura · sin ingesta automática a la memoria aprobada.</small>
    </div>
  </section>;
}
