import { useEffect, useMemo, useState } from 'react';
import './faith-reflection.css';

type SacredCode = {
  code: string;
  purpose: string;
  actionPrompt: string;
};

type FaithEntry = {
  id: string;
  date: string;
  code: string;
  purpose: string;
  action: string;
  evidence: string;
  completed45: boolean;
};

const sacredCodes: SacredCode[] = [
  { code: '88', purpose: 'Abundancia y prosperidad', actionPrompt: 'Define una acción concreta para cuidar, generar o administrar mejor tus recursos.' },
  { code: '520', purpose: 'Oportunidades económicas', actionPrompt: 'Da un paso verificable: solicitar, cobrar, vender, presupuestar o aprender.' },
  { code: '318798', purpose: 'Trabajo deseado', actionPrompt: 'Envía una solicitud, mejora tu perfil o contacta una oportunidad real.' },
  { code: '42170', purpose: 'Negocios', actionPrompt: 'Contacta un cliente, termina una propuesta o mejora una oferta.' },
  { code: '71588', purpose: 'Amor verdadero', actionPrompt: 'Practica una acción de honestidad, cuidado o apertura emocional saludable.' },
  { code: '771', purpose: 'Pareja compatible', actionPrompt: 'Haz una acción social saludable alineada con tus valores y límites.' },
  { code: '541', purpose: 'Fortalecer una relación', actionPrompt: 'Ten una conversación respetuosa o realiza un gesto concreto de cuidado.' },
  { code: '681', purpose: 'Paz y tranquilidad', actionPrompt: 'Reduce un factor de estrés controlable y reserva unos minutos de silencio.' },
  { code: '626', purpose: 'Liberarse del miedo', actionPrompt: 'Haz hoy un paso pequeño y seguro hacia aquello que estás evitando.' },
  { code: '991', purpose: 'Protección espiritual', actionPrompt: 'Refuerza un límite, una práctica de seguridad o una decisión prudente.' },
  { code: '512', purpose: 'Claridad e intuición', actionPrompt: 'Escribe hechos, opciones y consecuencias antes de decidir.' },
  { code: '725', purpose: 'Crecimiento espiritual', actionPrompt: 'Dedica tiempo a oración, reflexión, lectura o servicio a otra persona.' }
];

const prayer = `Dios, pongo delante de Ti mis necesidades, mis proyectos y mi futuro.
Dame sabiduría para reconocer las oportunidades, fortaleza para actuar,
paciencia para esperar lo necesario y claridad para alejarme de aquello que no me conviene.
Que todo lo que llegue a mi vida sea para bien, sin perjudicar a nadie y de acuerdo con Tu voluntad.
Bendice mi trabajo, mis finanzas, mi hogar, mi salud, mis relaciones y cada puerta que deba abrirse. Amén.`;

const STORAGE_KEY = 'atlas.faith-reflection.v1';

function loadState(): { selectedCode: string; count: number; action: string; evidence: string; entries: FaithEntry[] } {
  if (typeof window === 'undefined') return { selectedCode: '520', count: 0, action: '', evidence: '', entries: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      selectedCode: typeof parsed.selectedCode === 'string' ? parsed.selectedCode : '520',
      count: Number.isInteger(parsed.count) ? Math.max(0, Math.min(45, parsed.count)) : 0,
      action: typeof parsed.action === 'string' ? parsed.action : '',
      evidence: typeof parsed.evidence === 'string' ? parsed.evidence : '',
      entries: Array.isArray(parsed.entries) ? parsed.entries.slice(0, 21) : []
    };
  } catch {
    return { selectedCode: '520', count: 0, action: '', evidence: '', entries: [] };
  }
}

export function FaithReflectionPage() {
  const initial = useMemo(loadState, []);
  const [selectedCode, setSelectedCode] = useState(initial.selectedCode);
  const [count, setCount] = useState(initial.count);
  const [action, setAction] = useState(initial.action);
  const [evidence, setEvidence] = useState(initial.evidence);
  const [entries, setEntries] = useState<FaithEntry[]>(initial.entries);
  const [saved, setSaved] = useState(false);

  const selected = sacredCodes.find((item) => item.code === selectedCode) ?? sacredCodes[0];
  const progress = Math.round((count / 45) * 100);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedCode, count, action, evidence, entries }));
  }, [selectedCode, count, action, evidence, entries]);

  function chooseCode(code: string) {
    setSelectedCode(code);
    setCount(0);
    setSaved(false);
  }

  function repeatOnce() {
    setCount((current) => Math.min(45, current + 1));
    setSaved(false);
  }

  function resetSession() {
    setCount(0);
    setSaved(false);
  }

  function saveDay() {
    const trimmedAction = action.trim();
    if (!trimmedAction) return;
    const entry: FaithEntry = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
      date: new Date().toISOString(),
      code: selected.code,
      purpose: selected.purpose,
      action: trimmedAction,
      evidence: evidence.trim(),
      completed45: count === 45
    };
    setEntries((current) => [entry, ...current].slice(0, 21));
    setAction('');
    setEvidence('');
    setCount(0);
    setSaved(true);
  }

  return (
    <section className="faith-page" aria-labelledby="faith-title">
      <header className="faith-hero">
        <p className="faith-eyebrow">ATLAS · Faith & Reflection</p>
        <h1 id="faith-title">Código de Fe 45</h1>
        <p>Fe, oración, intención y acción verificable en una práctica diaria de 7–12 minutos.</p>
        <div className="faith-boundary" role="note">
          Los códigos se presentan como símbolos espirituales y de enfoque. ATLAS no afirma que los números tengan poderes sobrenaturales ni garantiza resultados.
        </div>
      </header>

      <div className="faith-layout">
        <aside className="faith-panel faith-library" aria-label="Biblioteca de códigos">
          <div className="faith-section-heading">
            <span>01</span>
            <div><strong>Elige una intención</strong><small>Una por sesión</small></div>
          </div>
          <div className="faith-code-grid">
            {sacredCodes.map((item) => (
              <button
                key={item.code}
                type="button"
                className={item.code === selected.code ? 'faith-code active' : 'faith-code'}
                onClick={() => chooseCode(item.code)}
                aria-pressed={item.code === selected.code}
              >
                <span>{item.code}</span>
                <small>{item.purpose}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="faith-main">
          <article className="faith-panel">
            <div className="faith-section-heading">
              <span>02</span>
              <div><strong>Oración</strong><small>Lee lentamente y con intención</small></div>
            </div>
            <blockquote>{prayer}</blockquote>
          </article>

          <article className="faith-panel faith-counter-card">
            <div className="faith-section-heading">
              <span>03</span>
              <div><strong>Repetición consciente</strong><small>{selected.purpose}</small></div>
            </div>
            <div className="faith-counter" aria-live="polite">
              <div className="faith-orbit" style={{ '--progress': `${progress}%` } as React.CSSProperties}>
                <div><strong>{selected.code}</strong><span>{count} / 45</span></div>
              </div>
              <div className="faith-counter-actions">
                <button type="button" className="faith-primary" onClick={repeatOnce} disabled={count >= 45}>
                  {count >= 45 ? '45 repeticiones completadas' : 'Repetir una vez'}
                </button>
                <button type="button" className="faith-secondary" onClick={resetSession}>Reiniciar contador</button>
                <small>{progress}% de la sesión</small>
              </div>
            </div>
          </article>

          <article className="faith-panel">
            <div className="faith-section-heading">
              <span>04</span>
              <div><strong>Acción real</strong><small>Convierte la intención en conducta verificable</small></div>
            </div>
            <p className="faith-prompt">{selected.actionPrompt}</p>
            <label className="faith-field">
              <span>¿Qué harás hoy?</span>
              <textarea value={action} onChange={(event) => setAction(event.target.value)} rows={3} placeholder="Ej.: enviar 3 solicitudes, llamar a un cliente, revisar mi presupuesto..." />
            </label>
            <label className="faith-field">
              <span>Evidencia o resultado</span>
              <textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={2} placeholder="Opcional: qué ocurrió realmente, sin interpretar coincidencias como garantías." />
            </label>
            <button type="button" className="faith-primary" onClick={saveDay} disabled={!action.trim()}>
              Guardar día en mi ciclo de 21 días
            </button>
            {saved && <p className="faith-success" role="status">Día registrado localmente.</p>}
          </article>
        </main>
      </div>

      <section className="faith-panel faith-history">
        <div className="faith-section-heading">
          <span>05</span>
          <div><strong>Ciclo de 21 días</strong><small>{entries.length} de 21 registros guardados en este dispositivo</small></div>
        </div>
        {entries.length === 0 ? (
          <div className="faith-empty">Todavía no hay registros. Completa tu primera sesión y guarda una acción real.</div>
        ) : (
          <div className="faith-entry-list">
            {entries.map((entry, index) => (
              <article key={entry.id} className="faith-entry">
                <div><strong>Día {entries.length - index}</strong><span>{new Date(entry.date).toLocaleDateString()}</span></div>
                <div><strong>{entry.code}</strong><span>{entry.purpose}</span></div>
                <p>{entry.action}</p>
                <span className={entry.completed45 ? 'faith-chip complete' : 'faith-chip'}>{entry.completed45 ? '45/45' : 'Sesión parcial'}</span>
                {entry.evidence && <small>Evidencia: {entry.evidence}</small>}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
