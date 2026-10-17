import { useState, type FormEvent } from 'react';

const key = 'atlas-tax-learning-2025-depreciation-v1';
type Progress = { attempts: number; best: number };
const emptyProgress: Progress = { attempts: 0, best: 0 };
const questions = [
  { label: 'Base inicial de la impresora ($)', expected: 960, reason: 'La base incluye $900 de precio y $60 de impuesto: $960.' },
  { label: 'Depreciación especial de 2025 ($)', expected: 960, reason: 'Con los supuestos de este caso, 100% de $960 = $960; no se deduce otra vez como suministros.' },
  { label: 'Ganancia neta revisada de Schedule C ($)', expected: 9740, reason: 'La ganancia anterior de $10,700 menos $960 es $9,740.' }
] as const;

function readProgress(): Progress {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (value && typeof value === 'object' && 'attempts' in value && 'best' in value
      && typeof value.attempts === 'number' && Number.isSafeInteger(value.attempts) && value.attempts >= 0
      && typeof value.best === 'number' && Number.isInteger(value.best) && value.best >= 0 && value.best <= 3) {
      return { attempts: value.attempts, best: value.best };
    }
  } catch { /* Storage may be unavailable or contain an older record. */ }
  return emptyProgress;
}

export function TaxDepreciationPractice() {
  const [answers, setAnswers] = useState(['', '', '']);
  const [result, setResult] = useState<boolean[] | null>(null);
  const [progress, setProgress] = useState(readProgress);
  const [storageMessage, setStorageMessage] = useState('');
  const score = result?.filter(Boolean).length ?? 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answers.some(value => value.trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) return;
    const checked = questions.map((question, index) => Number(answers[index]) === question.expected);
    setResult(checked);
    const next = { attempts: progress.attempts + 1, best: Math.max(progress.best, checked.filter(Boolean).length) };
    setProgress(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setStorageMessage('Progreso guardado solo en este navegador; no se sincroniza con tu cuenta.');
    } catch {
      setStorageMessage('El navegador no permitió guardar. El resultado se conserva durante esta visita.');
    }
  }

  return (
    <section id="depreciation-practice" className="tax-panel" aria-labelledby="depreciation-heading">
      <p className="eyebrow">Práctica 03 · base y depreciación · año tributario 2025</p>
      <h2 id="depreciation-heading">Del ingreso neto al registro de activos</h2>
      <p>Retomamos la ganancia neta de $10,700 del ejemplo de Elena. En junio de 2025 compra y pone en servicio una computadora nueva de $1,600 más $100 de impuesto sobre ventas, exclusivamente para su negocio.</p>
      <p>Para este ejercicio capitalizamos el equipo: no usamos section 179 ni la elección de gasto de minimis, no deducimos el impuesto por separado y suponemos que cumple los requisitos para depreciación especial del 100%, sin elecciones para reducirla o excluirla. No es una recomendación de elección fiscal para una declaración real.</p>
      <div className="tax-learning-table-wrap">
        <table className="tax-learning-table">
          <thead><tr><th scope="col">Registro / planilla</th><th scope="col">Cálculo</th><th scope="col">Importe</th></tr></thead>
          <tbody>
            <tr><th scope="row">Registro de activos · base inicial</th><td>Precio + impuesto sobre ventas</td><td>$1,700</td></tr>
            <tr><th scope="row">Form 4562 · línea 14</th><td>Depreciación especial: $1,700 × 100%</td><td>$1,700</td></tr>
            <tr><th scope="row">Schedule C · línea 13</th><td>Deducción por depreciación</td><td>$1,700</td></tr>
            <tr><th scope="row">Registro de activos · base ajustada</th><td>$1,700 − $1,700</td><td>$0</td></tr>
            <tr><th scope="row">Schedule C · línea 31</th><td>$10,700 − $1,700</td><td>$9,000</td></tr>
          </tbody>
        </table>
      </div>
      <p>Regla de 2025: determinados bienes calificados adquiridos y puestos en servicio después del 19 de enero de 2025 pueden recibir depreciación especial del 100%. No basta con pagar: el activo debe estar listo y disponible para su uso. Una base ajustada de cero no significa que el equipo no tenga valor de mercado.</p>
      <p className="tax-learning-sources">Fuentes IRS: <a href="https://www.irs.gov/instructions/i4562" target="_blank" rel="noreferrer">Form 4562, instrucciones de 2025</a> · <a href="https://www.irs.gov/publications/p946" target="_blank" rel="noreferrer">Publication 946, base y puesta en servicio</a> · <a href="https://www.irs.gov/instructions/i1040sc" target="_blank" rel="noreferrer">Schedule C, línea 13</a>.</p>
      <h3>Chequeo de depreciación</h3>
      <p>Caso separado: parte otra vez de $10,700 de ganancia neta y añade solamente una impresora calificada, comprada y puesta en servicio en mayo de 2025 por $900 más $60 de impuesto. Uso empresarial 100%; aplica los mismos supuestos del ejemplo. Responde antes de ver las soluciones.</p>
      <form className="tax-learning-form" onSubmit={submit}>
        {questions.map((question, index) => (
          <label className="field" key={question.label}>
            <span>{question.label}</span>
            <input type="number" min="0" step="0.01" required value={answers[index]} onChange={event => {
              const value = event.target.value;
              setAnswers(current => current.map((answer, position) => position === index ? value : answer));
              setResult(null);
            }} />
          </label>
        ))}
        <button className="primary-action" type="submit">Comprobar depreciación</button>
      </form>
      {result && (
        <div className="notice" role="status">
          <p><strong>Aciertos: {score}/3 · {Math.round(score / 3 * 100)}%</strong></p>
          <ul>{questions.map((question, index) => <li key={question.label}>{result[index] ? 'Correcto' : 'Repasar'}: {question.reason}</li>)}</ul>
          <p>{score === 3 ? 'Chequeo aprobado. Conserva la factura, la fecha de puesta en servicio y el registro del activo.' : 'Repasa los puntos marcados y vuelve a intentarlo. Cambiar una respuesta oculta la solución hasta el próximo envío.'}</p>
        </div>
      )}
      <p>Intentos en este navegador: {progress.attempts}. Mejor resultado: {progress.best}/3. Solo se guardan estos contadores del ejercicio ficticio, no datos tributarios personales.</p>
      {storageMessage && <p>{storageMessage}</p>}
    </section>
  );
}
