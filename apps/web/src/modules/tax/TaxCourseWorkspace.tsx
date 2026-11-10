import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ATLAS_SESSION_EVENT } from '../../lib/atlasSession';
import { gradeTaxLesson, TAX_COURSE_VERSION, TAX_LESSONS, type TaxLesson } from './taxCourseCatalog';
import { loadTaxLearningProgress, resolveTaxLearningContext, saveTaxLearningAttempt, type TaxLearningContext, type TaxLearningProgress } from './taxLearningRepository';
import './taxLearning.css';

type Attempt = { id: string; lessonId: string; correct: number; total: number };
export function TaxLessonView({ lesson, busy, onAttempt }: { lesson: TaxLesson; busy: boolean; onAttempt: (attempt: Attempt) => Promise<void> }) {
  const [answers, setAnswers] = useState(() => lesson.questions.map(() => ''));
  const [result, setResult] = useState<boolean[] | null>(null);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    try {
      const graded = gradeTaxLesson(lesson, answers);
      setError('');
      setResult(graded);
      await onAttempt({ id: crypto.randomUUID(), lessonId: lesson.id, correct: graded.filter(Boolean).length, total: graded.length });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo comprobar el intento.'); }
  }
  function change(index: number, value: string) {
    setAnswers(current => current.map((answer, position) => position === index ? value : answer));
    setResult(null); setError('');
  }
  return (
    <article className="tax-panel" aria-labelledby="course-lesson-title">
      <p className="eyebrow">{lesson.topic} · 2025 · {TAX_COURSE_VERSION}</p>
      <h2 id="course-lesson-title">{lesson.title}</h2>
      <p>{lesson.scenario}</p>
      <h3>Ejemplo explicado</h3><p>{lesson.teaching}</p>
      <div className="tax-learning-table-wrap"><table className="tax-learning-table">
        <thead><tr><th scope="col">Destino</th><th scope="col">Concepto / importe</th></tr></thead>
        <tbody>{lesson.mappings.map(([form, value]) => <tr key={form}><th scope="row">{form}</th><td>{value}</td></tr>)}</tbody>
      </table></div>
      <p className="tax-learning-sources">Fuentes oficiales: {lesson.sources.map((source, index) => <span key={source}>{index > 0 && ' · '}<a href={source} target="_blank" rel="noreferrer">IRS · {source.split('/').pop()}</a></span>)}</p>
      <h3>Chequeo: responde antes de ver la solución</h3>
      <form className="tax-learning-form" onSubmit={submit}>
        {lesson.questions.map((question, index) => <label className="field" key={question.prompt}>
          <span>{question.prompt}</span>
          {question.options ? <select required disabled={busy} value={answers[index]} onChange={event => change(index, event.target.value)}>
            <option value="">Selecciona</option>{question.options.map(option => <option key={option} value={option}>{option}</option>)}
          </select> : <input required disabled={busy} type="number" step="0.01" value={answers[index]} onChange={event => change(index, event.target.value)} />}
        </label>)}
        <button className="primary-action" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Comprobar y guardar intento'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && <div className="notice" role="status">
        <strong>Aciertos: {result.filter(Boolean).length}/{result.length} · {Math.round(100 * result.filter(Boolean).length / result.length)}%</strong>
        <ul>{lesson.questions.map((question, index) => <li key={question.prompt}>{result[index] ? 'Correcto' : 'Repasar'}: {question.explanation}</li>)}</ul>
        <p>{result.every(Boolean) ? 'Práctica dominada: todas las respuestas correctas.' : 'Repasa los errores y vuelve a intentarlo. Cambiar una respuesta oculta el feedback hasta el próximo envío.'}</p>
      </div>}
    </article>
  );
}

export function TaxCourseWorkspace() {
  const [epoch, setEpoch] = useState(0);
  const generation = useRef(0);
  const [context, setContext] = useState<TaxLearningContext | null>(null);
  const [progress, setProgress] = useState<TaxLearningProgress>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState(TAX_LESSONS[0].id);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Verificando identidad y progreso…');
  const [pending, setPending] = useState<Attempt | null>(null);

  useEffect(() => {
    const changed = () => { generation.current += 1; setContext(null); setProgress([]); setConfirmed(false); setPending(null); setLoading(true); setBusy(false); setEpoch(value => value + 1); };
    window.addEventListener(ATLAS_SESSION_EVENT, changed);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, changed);
  }, []);
  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    setLoading(true); setContext(null); setProgress([]); setConfirmed(false); setPending(null);
    void (async () => {
      try {
        const resolved = await resolveTaxLearningContext();
        if (cancelled) return;
        setContext(resolved);
        try {
          const rows = await loadTaxLearningProgress(resolved);
          if (cancelled) return;
          setProgress(rows); setConfirmed(true);
          setSelected(TAX_LESSONS.find(lesson => !rows.some(row => row.lesson_id === lesson.id && row.best_percent === 100))?.id || TAX_LESSONS[0].id);
          setMessage('Progreso cargado de tu cuenta y organización. Se sincroniza tras cada intento confirmado.');
        } catch {
          if (!cancelled) setMessage('No se pudo cargar el progreso. Puedes estudiar; los resultados no se consideran guardados hasta confirmar la conexión. Verifica también que la migración de aprendizaje esté aplicada.');
        }
      } catch {
        if (!cancelled) setMessage('No se pudo verificar la cuenta. Puedes estudiar, pero no guardar progreso. Recarga o inicia sesión.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [epoch]);

  async function persist(attempt: Attempt) {
    setPending(attempt);
    if (!context) { setMessage('Intento no guardado: falta una identidad verificada.'); return; }
    const currentGeneration = generation.current;
    setBusy(true); setMessage('Guardando intento en tu cuenta…');
    try {
      await saveTaxLearningAttempt(context, attempt);
      const rows = await loadTaxLearningProgress(context);
      if (currentGeneration !== generation.current) return;
      setProgress(rows); setPending(null); setMessage('Intento confirmado y progreso sincronizado con tu cuenta.');
    } catch {
      if (currentGeneration === generation.current) setMessage('No se confirmó el guardado. Reintenta con el mismo identificador para evitar duplicar el intento. No se presenta ninguna declaración.');
    } finally { if (currentGeneration === generation.current) setBusy(false); }
  }

  const mastered = progress.filter(row => row.best_percent === 100).length;
  const percent = Math.round(100 * mastered / TAX_LESSONS.length);
  const visible = TAX_LESSONS.filter(lesson => {
    const row = progress.find(item => item.lesson_id === lesson.id);
    return (lesson.title + ' ' + lesson.topic).toLowerCase().includes(query.toLowerCase())
      && (filter === 'all' || (filter === 'pending' && row?.best_percent !== 100) || (filter === 'review' && !!row && row.best_percent < 100));
  });
  const lesson = TAX_LESSONS.find(item => item.id === selected)!;
  const position = TAX_LESSONS.indexOf(lesson);
  return (
    <div className="page-stack tax-learning">
      <header className="tax-panel">
        <p className="eyebrow">ATLAS Tax · Learning · CPA/EA foundation</p><h1>Curso práctico de preparación tributaria</h1>
        <p>20 lecciones disponibles desde ahora: 1040, schedules, negocios, depreciación/base y e-file. Casos ficticios para el año tributario 2025, no una cobertura exhaustiva de toda la ley fiscal ni una acreditación. Estudia tres sesiones por semana y repasa los errores.</p>
        <p>No introduce datos de tu declaración, no genera una declaración lista para presentar y no transmite al IRS. Las lecciones mantienen el año y las fuentes IRS explícitos.</p>
        {confirmed ? <label>Lecciones dominadas: {mastered}/{TAX_LESSONS.length} · {percent}% <progress max={TAX_LESSONS.length} value={mastered} /></label> : <p>Progreso de cuenta aún no confirmado.</p>}
        <p aria-live="polite">{message}</p>
        <div className="tax-pro-actions">
          <button type="button" disabled={busy || loading || !!pending} onClick={() => setEpoch(value => value + 1)}>Recargar progreso de mi cuenta</button>
          {pending && <p>Intento pendiente: {TAX_LESSONS.find(item => item.id === pending.lessonId)?.title}. Reintenta o descártalo antes de otro chequeo.</p>}
          {pending && <button type="button" disabled={busy} onClick={() => { setPending(null); setMessage('Intento pendiente descartado; no se afirma que esté guardado.'); }}>Descartar intento pendiente</button>}
          {pending && <button type="button" disabled={busy || loading || !context} onClick={() => void persist(pending)}>Reintentar guardado pendiente</button>}
        </div>
      </header>
      {loading ? <p role="status">Cargando cuenta y progreso…</p> : <>
        <section className="tax-panel" aria-label="Catálogo del curso">
          <div className="tax-learning-form">
            <label className="field"><span>Buscar lecciones</span><input value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label className="field"><span>Filtrar progreso</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todas</option><option value="pending">Pendientes</option><option value="review">Repasar errores</option></select></label>
          </div>
          <div className="tax-learning-grid">{visible.map(item => {
            const row = progress.find(record => record.lesson_id === item.id);
            return <button type="button" key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); }}>
              <strong>{item.title}</strong><span>{row ? row.attempts + ' intentos · mejor ' + row.best_percent + '%' : confirmed ? 'Sin intentos confirmados' : 'Progreso no disponible'}</span>
            </button>;
          })}</div>
          {!visible.length && <p>No hay lecciones para este filtro.</p>}
        </section>
        <TaxLessonView key={selected + ':' + epoch} lesson={lesson} busy={busy || !!pending} onAttempt={persist} />
        <nav className="tax-pro-actions" aria-label="Secuencia de lecciones">
          <button disabled={busy || position === 0} type="button" onClick={() => { setSelected(TAX_LESSONS[position - 1].id); }}>Anterior</button>
          <button disabled={busy || position === TAX_LESSONS.length - 1} type="button" onClick={() => { setSelected(TAX_LESSONS[position + 1].id); }}>Siguiente</button>
        </nav>
      </>}
    </div>
  );
}
