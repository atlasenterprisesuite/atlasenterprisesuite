import { useState, type FormEvent } from 'react';
import './taxLearning.css';
import { TaxDepreciationPractice } from './TaxDepreciationPractice';

const progressKey = 'atlas-tax-learning-2025-1099k-v1';
const money = (amount: number) => '$' + amount.toLocaleString('en-US');

type Attempt = { gross: number; profit: number; doubleCount: string };

function readProgress(): boolean {
  try {
    return window.localStorage.getItem(progressKey) === 'complete';
  } catch {
    return false;
  }
}

export function TaxLearningPage() {
  const [completed, setCompleted] = useState(readProgress);
  const [gross, setGross] = useState('');
  const [profit, setProfit] = useState('');
  const [doubleCount, setDoubleCount] = useState('');
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  const correct = attempt !== null && attempt.gross === 9500 && attempt.profit === 7700 && attempt.doubleCount === 'no';

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { gross: Number(gross), profit: Number(profit), doubleCount };
    setAttempt(next);
    if (next.gross === 9500 && next.profit === 7700 && next.doubleCount === 'no') {
      setCompleted(true);
      try { window.localStorage.setItem(progressKey, 'complete'); } catch { /* Storage may be unavailable. */ }
    }
  }

  return (
    <div className="page-stack tax-learning">
      <nav className="tax-nav" aria-label="Lecciones de práctica"><a href="#receipts-practice">02 · Conciliación</a><a href="#depreciation-practice">03 · Depreciación y base</a></nav>
      <header id="receipts-practice" className="tax-panel">
        <p className="eyebrow">Aprendizaje de taxes · práctica 02 · año tributario 2025</p>
        <h1>Conciliar el 1099-K con el Schedule C</h1>
        <p>Una sesión breve para preparar la declaración federal de una persona que trabaja por cuenta propia. Los importes son ficticios; esta práctica no crea ni envía una declaración.</p>
        <span className="tax-status ok">{completed ? 'Chequeo completado en este navegador' : 'En progreso'}</span>
      </header>

      <section className="tax-panel" aria-labelledby="learning-case">
        <h2 id="learning-case">Expediente de ejemplo</h2>
        <p>Elena presta servicios mediante una plataforma. Para 2025 recibió un Form 1099-K de {money(12000)} por pagos de clientes y un Form 1099-NEC de {money(800)} por un bono separado. La plataforma retuvo {money(2400)} en comisiones y depositó {money(10400)} en su banco. Elena cobró otros {money(600)} en efectivo y gastó {money(300)} en suministros.</p>
        <div className="tax-learning-grid">
          <article><small>1099-K</small><strong>{money(12000)}</strong><span>Pagos brutos de clientes</span></article>
          <article><small>1099-NEC</small><strong>{money(800)}</strong><span>Bono fuera del 1099-K</span></article>
          <article><small>Banco</small><strong>{money(10400)}</strong><span>Depósito neto; control de conciliación</span></article>
        </div>
      </section>

      <section className="tax-panel" aria-labelledby="learning-map">
        <h2 id="learning-map">Razonamiento y destino en las planillas</h2>
        <p>El Form 1099-K informa pagos <strong>brutos</strong>. El depósito bancario verifica {money(12000)} + {money(800)} − {money(2400)} = {money(10400)}; no es otro ingreso. El efectivo sí se suma aunque no aparezca en el 1099-K.</p>
        <div className="tax-learning-table-wrap">
          <table className="tax-learning-table">
            <thead><tr><th scope="col">Planilla / línea</th><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead>
            <tbody>
              <tr><th scope="row">Schedule C, línea 1</th><td>1099-K + bono 1099-NEC + efectivo</td><td>{money(13400)}</td></tr>
              <tr><th scope="row">Schedule C, línea 10</th><td>Comisiones de plataforma</td><td>{money(2400)}</td></tr>
              <tr><th scope="row">Schedule C, línea 22</th><td>Suministros</td><td>{money(300)}</td></tr>
              <tr><th scope="row">Schedule C, línea 31</th><td>Ganancia neta: 13,400 − 2,700</td><td><strong>{money(10700)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <p>La ganancia neta pasa al <a href="https://www.irs.gov/pub/irs-pdf/f1040s1.pdf" target="_blank" rel="noreferrer">Schedule 1, línea 3</a> y luego al <a href="https://www.irs.gov/pub/irs-pdf/f1040.pdf" target="_blank" rel="noreferrer">Form 1040, línea 8</a>. Evalúa también el <a href="https://www.irs.gov/forms-pubs/about-schedule-se-form-1040" target="_blank" rel="noreferrer">Schedule SE</a> para el impuesto de trabajo por cuenta propia.</p>
        <p className="tax-learning-sources">Fuentes: <a href="https://www.irs.gov/businesses/what-to-do-with-form-1099-k" target="_blank" rel="noreferrer">IRS, qué hacer con Form 1099-K</a> · <a href="https://www.irs.gov/instructions/i1040sc" target="_blank" rel="noreferrer">IRS, instrucciones de Schedule C</a>.</p>
      </section>

      <section className="tax-panel" aria-labelledby="learning-check">
        <h2 id="learning-check">Chequeo breve</h2>
        <p>Otro profesional recibe un 1099-K de {money(9000)}; la plataforma retiene {money(1800)} y deposita {money(7200)}. También cobra {money(500)} en efectivo. No tiene otros ingresos ni gastos. Responde antes de ver la solución.</p>
        <form className="tax-learning-form" onSubmit={check}>
          <label className="field"><span>Schedule C, línea 1 · ingresos brutos ($)</span><input type="number" min="0" step="1" required value={gross} onChange={(event) => { setGross(event.target.value); setAttempt(null); }} /></label>
          <label className="field"><span>Schedule C, línea 31 · ganancia neta ($)</span><input type="number" min="0" step="1" required value={profit} onChange={(event) => { setProfit(event.target.value); setAttempt(null); }} /></label>
          <label className="field"><span>¿Se suma de nuevo el depósito bancario?</span><select required value={doubleCount} onChange={(event) => { setDoubleCount(event.target.value); setAttempt(null); }}><option value="">Selecciona</option><option value="yes">Sí</option><option value="no">No</option></select></label>
          <button className="primary-action" type="submit">Comprobar respuestas</button>
        </form>
        {attempt && <div className="notice" role="status"><strong>{correct ? 'Correcto.' : 'Revisa tu cálculo.'}</strong> Ingresos brutos: {money(9000)} + {money(500)} = {money(9500)}. Comisiones: {money(1800)}. Ganancia neta: {money(7700)}. El depósito de {money(7200)} ya está incluido en el pago bruto del 1099-K; sumarlo de nuevo duplicaría ingresos.</div>}
      </section>
      <TaxDepreciationPractice />
    </div>
  );
}
