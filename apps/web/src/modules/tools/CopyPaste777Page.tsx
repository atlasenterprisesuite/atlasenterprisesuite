import { useEffect, useState } from 'react';

const KEY = 'atlas.copy-paste-777.v1';
type Template = { id: string; title: string; content: string };
const defaults: Template[] = [
  { id: 'review', title: 'ATLAS 777 REVIEW', content: 'ATLAS 777 REVIEW\nObjetivo:\nRepositorio:\nCriterios de aceptación:\nEvidencias:\nBloqueos P0:\nNo declarar éxito sin evidencia verificable.' },
  { id: 'pr809', title: 'PR #809 — Telephony', content: 'ATLAS 777 REVIEW — PR #809\nRepositorio: atlasenterprisesuite/atlasenterprisesuite\nValidar enrutamiento, autenticación y RLS con simuladores. Registrar CI exact-SHA. No fusionar, desplegar ni activar PSTN mientras P0 esté abierto.' }
];
function readSaved(): { templates: Template[]; history: string[] } {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      templates: Array.isArray(parsed.templates) ? parsed.templates.filter((t: Template) => typeof t?.id === 'string' && typeof t?.title === 'string' && typeof t?.content === 'string').slice(0, 30) : defaults,
      history: Array.isArray(parsed.history) ? parsed.history.filter((s: unknown) => typeof s === 'string').slice(0, 20) : []
    };
  } catch { return { templates: defaults, history: [] }; }
}
export function CopyPaste777Page() {
  const [saved] = useState(readSaved);
  const [templates, setTemplates] = useState(saved.templates);
  const [history, setHistory] = useState(saved.history);
  const [selected, setSelected] = useState(saved.templates[0]?.id || '');
  const [title, setTitle] = useState(saved.templates[0]?.title || '');
  const [content, setContent] = useState(saved.templates[0]?.content || '');
  const [message, setMessage] = useState('');
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ templates, history })); }
    catch { setMessage('Almacenamiento local no disponible. Puedes seguir copiando.'); }
  }, [templates, history]);
  const load = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    setSelected(id); setTitle(template.title); setContent(template.content); setMessage('');
  };
  const save = () => {
    if (!title.trim() || !content.trim()) { setMessage('Escribe un título y contenido.'); return; }
    const id = selected || 'custom-' + Date.now().toString(36);
    setTemplates(old => [{ id, title: title.trim(), content }, ...old.filter(t => t.id !== id)].slice(0, 30));
    setSelected(id); setMessage('Plantilla guardada en este navegador.');
  };
  const copy = async (text: string) => {
    if (!text.trim()) { setMessage('No hay contenido para copiar.'); return; }
    try {
      await navigator.clipboard.writeText(text);
      setHistory(old => [text, ...old.filter(x => x !== text)].slice(0, 20));
      setMessage('Copiado al portapapeles.');
    } catch { setMessage('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.'); }
  };
  return <main className="page-stack" style={{ maxWidth: 850, margin: '2rem auto', padding: '1rem' }}>
    <header className="page-header"><p className="eyebrow">ATLAS Tools</p><h1>Copiar y Pegar 777</h1><p>Plantillas reutilizables e historial local. No envía instrucciones ni ejecuta acciones externas.</p></header>
    <label htmlFor="atlas-template">Plantilla</label>
    <select id="atlas-template" value={selected} onChange={e => load(e.target.value)}>
      <option value="">Nueva plantilla</option>{templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
    </select>
    <label htmlFor="atlas-title">Título</label>
    <input id="atlas-title" value={title} onChange={e => setTitle(e.target.value)} />
    <label htmlFor="atlas-content">Instrucción</label>
    <textarea id="atlas-content" rows={14} value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%' }} />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <button type="button" onClick={() => void copy(content)}>Copiar todo</button>
      <button type="button" onClick={save}>Guardar plantilla</button>
      <button type="button" onClick={() => { setSelected(''); setTitle(''); setContent(''); }}>Nueva</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    <h2>Historial de copias</h2>
    {history.length === 0 ? <p>Aún no hay copias guardadas.</p> : <ul>{history.map((item, i) =>
      <li key={i}><span>{item.slice(0, 100)}</span> <button type="button" onClick={() => void copy(item)}>Copiar otra vez</button></li>)}</ul>}
    <p>Privacidad: el historial se guarda solo en este dispositivo mediante almacenamiento local del navegador. No lo utilices para contraseñas ni secretos.</p>
    <button type="button" onClick={() => { setHistory([]); setMessage('Historial borrado en este navegador.'); }}>Borrar historial</button>
  </main>;
}
