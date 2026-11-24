import { useState } from 'react';
import { Link } from 'react-router-dom';
import './lumbar-explorer.css';

const structures = [
  { id: 'bone', label: 'Vértebra', color: '#dfcba6' },
  { id: 'disc', label: 'Disco', color: '#99cfea' },
  { id: 'nerve', label: 'Nervio', color: '#ffd65a' }
] as const;
type Structure = typeof structures[number]['id'];

export function LumbarExplorerPage() {
  const [visible, setVisible] = useState<Structure[]>(['bone', 'disc', 'nerve']);
  const [selected, setSelected] = useState<Structure | null>(null);
  const current = structures.find(item => item.id === selected);
  function toggle(id: Structure) {
    setVisible(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
    if (selected === id) setSelected(null);
  }
  return <section className="page-stack lumbar-explorer" lang="es">
    <nav aria-label="Volver al módulo"><Link to="/health">Health</Link> · <Link to="/learning">Learning</Link></nav>
    <header className="page-header"><p className="eyebrow">ATLAS Health · Learning</p>
      <h1>Explora la columna lumbar</h1>
      <p>Esquema educativo interactivo en 2D. No es una imagen de paciente ni un simulador quirúrgico.</p>
    </header>
    <p>Revisión anatómica profesional pendiente. Modelo 3D validado aún no disponible. No usar para diagnóstico, tratamiento o planificación quirúrgica.</p>
    <div className="lumbar-layout">
      <div>
        <fieldset><legend>Capas del esquema</legend>{structures.map(item => <label key={item.id}>
          <input type="checkbox" checked={visible.includes(item.id)} onChange={() => toggle(item.id)} /> Mostrar {item.label.toLowerCase()}
        </label>)}</fieldset>
        <button type="button" onClick={() => { setVisible(['bone', 'disc', 'nerve']); setSelected(null); }}>Restablecer</button>
        <h2>Selecciona una estructura</h2>
        <div className="lumbar-controls">{structures.filter(item => visible.includes(item.id)).map(item =>
          <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div>
        <p role="status">{current ? `${current.label} seleccionado` : 'Ninguna estructura seleccionada'}</p>
        {!visible.length && <p>Activa una capa para explorar el esquema.</p>}
      </div>
      <figure>
        <svg viewBox="0 0 400 340" role="img" aria-labelledby="lumbar-title lumbar-description">
          <title id="lumbar-title">Esquema lumbar simplificado</title>
          <desc id="lumbar-description">Representación conceptual, sin escala. Usa los botones de estructura y las casillas de capas para explorar.</desc>
          {visible.includes('bone') && <g fill="#dfcba6" stroke={selected === 'bone' ? '#fff' : '#806b4b'} strokeWidth="5"><rect x="100" y="25" width="200" height="100" rx="35"/><rect x="100" y="215" width="200" height="100" rx="35"/></g>}
          {visible.includes('disc') && <ellipse cx="200" cy="170" rx="95" ry="37" fill="#99cfea" stroke={selected === 'disc' ? '#fff' : '#477389'} strokeWidth="5"/>}
          {visible.includes('nerve') && <path d="M325 30 V310 M325 170 H375" fill="none" stroke="#ffd65a" strokeWidth={selected === 'nerve' ? 18 : 10}/>}
        </svg>
        <figcaption>Esquema conceptual sin escala ni precisión anatómica certificada.</figcaption>
      </figure>
    </div>
    <h2>Alternativa textual</h2>
    <ul>{structures.map(item => <li key={item.id}>{item.label}: capa {visible.includes(item.id) ? 'visible' : 'oculta'}{selected === item.id ? ', seleccionada' : ''}.</li>)}</ul>
  </section>;
}
