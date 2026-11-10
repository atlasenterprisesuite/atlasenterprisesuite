import { useState } from 'react';
import { RideSubnav } from './RideSubnav';
import { filterTransportModes, TRANSPORT_MATURITY_LABELS } from './worldTransportCatalog';

const domains = [
  ['all','Todos'],['human','Humano'],['animal','Animal'],['road','Carretera'],['rail','Ferroviario'],
  ['water','Acuático'],['air','Aéreo'],['cable','Cable y vertical'],['underground','Subterráneo'],
  ['space','Espacial'],['pipeline','Tuberías'],['logistics','Logística']
] as const;
export function WorldTransportPage() {
  const [domain,setDomain] = useState('all');
  const [maturity,setMaturity] = useState('all');
  const [query,setQuery] = useState('');
  const modes = filterTransportModes(domain,maturity,query);
  return <section className="ride-page ride-route-pilot">
    <header><p className="eyebrow">ATLAS Mobility · Knowledge</p><h1>Atlas mundial del transporte</h1>
      <p>Explora la evolución y las tecnologías de movilidad. Inventario educativo, no disponibilidad comercial ni certificación de proveedores.</p></header>
    <RideSubnav />
    <div className="ride-metadata-grid">
      <div><label htmlFor="transport-domain">Medio</label><select id="transport-domain" value={domain} onChange={event=>setDomain(event.target.value)}>{domains.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
      <div><label htmlFor="transport-maturity">Madurez orientativa</label><select id="transport-maturity" value={maturity} onChange={event=>setMaturity(event.target.value)}>
        <option value="all">Todas</option>{Object.entries(TRANSPORT_MATURITY_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></div>
      <div><label htmlFor="transport-search">Buscar</label><input id="transport-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Vehículo, época o tecnología" /></div>
    </div>
    <p role="status" aria-live="polite">{modes.length} medios en la selección · Catálogo inicial no exhaustivo</p>
    <div className="transport-catalog-grid">
      {modes.map(mode=><article className="ride-requirement-card" key={mode.id}>
        <p className="eyebrow">{mode.domain} · {mode.era}</p>
        <h2>{mode.name}</h2><p>{mode.description}</p>
        <p><strong>Clasificación:</strong> {TRANSPORT_MATURITY_LABELS[mode.maturity]}</p>
      </article>)}
    </div>
    {modes.length===0 && <p>No hay coincidencias. Modifica los filtros.</p>}
    <p className="ride-privacy-note">Los estados indican madurez general de la categoría, no autorización local, certificación vigente ni disponibilidad actual. Verificar con reguladores y operadores antes de cualquier integración real. No se envían búsquedas a terceros.</p>
  </section>;
}
