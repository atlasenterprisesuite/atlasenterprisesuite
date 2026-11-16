import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildReconciliationEvidence,
  parseReconciliationCsv,
  RECONCILIATION_MAX_BYTES,
  type ReconciliationEvidence,
  type ReconciliationSource
} from '../../../../../../packages/accounting/src';
import './bank-reconciliation.css';

type SourceKind = 'bank' | 'ledger';
type SourceState = { source: ReconciliationSource | null; loading: boolean; error: string };
const emptySource = (): SourceState => ({ source: null, loading: false, error: '' });
const labels: Record<SourceKind, string> = { bank: 'Archivo del banco', ledger: 'Archivo del libro contable' };
const exceptionLabels = { missing_reference: 'Falta referencia', no_candidate: 'Sin coincidencia', ambiguous: 'Ambiguo: requiere revisión' };
const template = 'id,date,amount,currency,reference,description\r\n';

function readBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
}

function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const revoke = URL.revokeObjectURL.bind(URL);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => revoke(url), 1000);
}

export function BankReconciliationPage() {
  const [sources, setSources] = useState<Record<SourceKind, SourceState>>({ bank: emptySource(), ledger: emptySource() });
  const [windowDays, setWindowDays] = useState('3');
  const [report, setReport] = useState<ReconciliationEvidence | null>(null);
  const [error, setError] = useState('');
  const [inputGeneration, setInputGeneration] = useState(0);
  const versions = useRef({ bank: 0, ledger: 0 });
  useEffect(() => () => { versions.current.bank++; versions.current.ledger++; }, []);

  const updateSource = (kind: SourceKind, next: SourceState) => setSources(previous => ({ ...previous, [kind]: next }));
  const validWindow = /^\d+$/.test(windowDays) && Number(windowDays) <= 30;
  const ready = !!sources.bank.source && !!sources.ledger.source && !sources.bank.loading && !sources.ledger.loading && validWindow;

  async function importFile(kind: SourceKind, file?: File) {
    const version = ++versions.current[kind];
    setReport(null);
    setError('');
    if (!file) { updateSource(kind, emptySource()); return; }
    updateSource(kind, { source: null, loading: true, error: '' });
    try {
      if (file.size > RECONCILIATION_MAX_BYTES) throw new Error('El archivo supera 2 MiB.');
      const bytes = await readBytes(file);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const entries = parseReconciliationCsv(text);
      if (!crypto.subtle) throw new Error('SHA-256 requiere un navegador con HTTPS o localhost.');
      const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (versions.current[kind] !== version) return;
      updateSource(kind, { source: { fileName: file.name, sha256, entries }, loading: false, error: '' });
    } catch (cause) {
      if (versions.current[kind] !== version) return;
      updateSource(kind, { source: null, loading: false, error: cause instanceof Error ? cause.message : 'No se pudo importar el CSV.' });
    }
  }

  function compare() {
    if (!ready || !sources.bank.source || !sources.ledger.source) return;
    setError('');
    try {
      setReport(buildReconciliationEvidence({ bank: sources.bank.source, ledger: sources.ledger.source }, { dateWindowDays: Number(windowDays) }, new Date().toISOString()));
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo comparar.');
    }
  }

  function clear() {
    versions.current.bank++;
    versions.current.ledger++;
    setSources({ bank: emptySource(), ledger: emptySource() });
    setReport(null);
    setError('');
    setInputGeneration(previous => previous + 1);
  }

  const formatMoney = (minor: number) => {
    const value = BigInt(minor);
    const magnitude = value < 0n ? -value : value;
    // Keep the final two digits exact even at Number.MAX_SAFE_INTEGER cents.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: report?.result.totals.currency ?? 'USD' })
      .formatToParts(value < 0n ? -1 : 1)
      .map(part => part.type === 'integer' ? (magnitude / 100n).toLocaleString('en-US') : part.type === 'fraction' ? String(magnitude % 100n).padStart(2, '0') : part.value)
      .join('');
  };

  return (
    <div className="page-stack bank-reconciliation" lang="es">
      <header className="page-header">
        <p className="eyebrow">ATLAS · Finance / Accounting</p>
        <h1>Conciliación de archivos</h1>
        <p>Compara movimientos del banco y del libro contable. Las coincidencias son propuestas para revisar; no contabilizan ni aprueban movimientos.</p>
        <Link to="/finance/accounting">Volver a Contabilidad</Link>
      </header>
      <div className="notice" role="note">Los archivos permanecen en la memoria de esta página. No se envían a un servidor ni se guardan en el navegador. Descarga la evidencia antes de cerrar o recargar.</div>
      <section className="workspace-card" aria-labelledby="reconciliation-input-title">
        <h2 id="reconciliation-input-title">Importar movimientos</h2>
        <p id="reconciliation-format">CSV UTF-8 · máximo 2 MiB y 10.000 filas por archivo. Columnas requeridas: id, date, amount, currency. Opcionales: reference, description.</p>
        <p>Fecha: YYYY-MM-DD. Importe: decimal con punto, sin separadores de miles; positivo para entradas y negativo para salidas en ambos archivos. Monedas: USD, EUR, GBP, CAD y AUD, una misma moneda para ambos.</p>
        <div className="reconciliation-imports">
          {(['bank', 'ledger'] as const).map(kind => (
            <div className="reconciliation-source" key={kind}>
              <label htmlFor={`reconciliation-${kind}`}>{labels[kind]}</label>
              <input key={`${kind}-${inputGeneration}`} id={`reconciliation-${kind}`} type="file" accept=".csv,text/csv" aria-describedby="reconciliation-format" onChange={event => void importFile(kind, event.target.files?.[0])} />
              <p role="status" aria-live="polite">{sources[kind].loading ? 'Leyendo y verificando SHA-256…' : sources[kind].source ? `${sources[kind].source.fileName} · ${sources[kind].source.entries.length} movimientos` : 'Sin archivo importado.'}</p>
              {sources[kind].source ? <code>SHA-256: {sources[kind].source.sha256}</code> : null}
              {sources[kind].error ? <p className="notice strong" role="alert">{sources[kind].error}</p> : null}
            </div>
          ))}
        </div>
        <div className="reconciliation-actions">
          <button type="button" className="module-experience-action secondary" onClick={() => download(template, 'ATLAS_movimientos_plantilla.csv', 'text/csv;charset=utf-8')}>Descargar plantilla CSV</button>
          <label htmlFor="reconciliation-window">Ventana de fechas en días
            <input id="reconciliation-window" type="number" min="0" max="30" step="1" value={windowDays} aria-invalid={!validWindow} aria-describedby="reconciliation-rule" onChange={event => { setWindowDays(event.target.value); setReport(null); setError(''); }} />
          </label>
          <button type="button" className="module-experience-action" disabled={!ready} onClick={compare}>Comparar movimientos</button>
          <button type="button" className="module-experience-action secondary" onClick={clear}>Borrar archivos y resultado</button>
        </div>
        <p id="reconciliation-rule" className="muted">Ventana de 0 a 30 días. Se exige referencia no vacía, mismo importe y signo, y un único candidato en ambas direcciones. Los casos ambiguos permanecen pendientes.</p>
      </section>
      {error ? <div className="notice strong" role="alert">{error}</div> : null}
      {report ? (
        <section className="page-stack" aria-labelledby="reconciliation-result-title">
          <div className="workspace-card">
            <h2 id="reconciliation-result-title">Resultado pendiente de revisión</h2>
            <p role="status">Comparación local preparada. Banco no conectado · sin contabilizar · revisión humana requerida.</p>
            <button type="button" className="module-experience-action" onClick={() => download(JSON.stringify(report, null, 2), 'ATLAS_conciliacion_evidencia.json', 'application/json')}>Descargar evidencia JSON</button>
            <p className="muted">Incluye todas las filas normalizadas, SHA-256 de los archivos originales, reglas y resultado. Es un informe local sin firma; los hashes no acreditan la autenticidad del banco ni la identidad del autor.</p>
          </div>
          <div className="metric-grid">
            <article aria-label="Cantidad de propuestas"><span>Coincidencias propuestas</span><strong>{report.result.proposals.length}</strong></article>
            <article aria-label="Excepciones del banco"><span>Pendientes del banco</span><strong>{report.result.bankExceptions.length}</strong></article>
            <article aria-label="Excepciones del libro"><span>Pendientes del libro</span><strong>{report.result.ledgerExceptions.length}</strong></article>
            <article aria-label="Diferencia entre totales"><span>Diferencia entre totales</span><strong>{formatMoney(report.result.totals.differenceMinor)}</strong></article>
          </div>
          <section className="workspace-card">
            <h3>Coincidencias propuestas</h3>
            <p>Total banco: {formatMoney(report.result.totals.bankMinor)} · Total libro: {formatMoney(report.result.totals.ledgerMinor)}. Una diferencia de cero no confirma la conciliación.</p>
            {report.result.proposals.length ? <div className="table-wrap"><table aria-label="Coincidencias propuestas">
              <thead><tr><th scope="col">ID banco</th><th scope="col">ID libro</th><th scope="col">Importe</th><th scope="col">Días de diferencia</th></tr></thead>
              <tbody>{report.result.proposals.slice(0, 50).map(row => <tr key={row.bankId}><td>{row.bankId}</td><td>{row.ledgerId}</td><td>{formatMoney(row.amountMinor)}</td><td>{row.dateDeltaDays}</td></tr>)}</tbody>
            </table></div> : <p>No hay coincidencias propuestas.</p>}
            {report.result.proposals.length > 50 ? <p>Vista previa: 50 de {report.result.proposals.length}. La descarga JSON contiene todas.</p> : null}
          </section>
          {(['bank', 'ledger'] as const).map(kind => {
            const exceptions = kind === 'bank' ? report.result.bankExceptions : report.result.ledgerExceptions;
            return <section className="workspace-card" key={kind}>
              <h3>Pendientes {kind === 'bank' ? 'del banco' : 'del libro contable'}</h3>
              {exceptions.length ? <div className="table-wrap"><table aria-label={`Pendientes ${kind === 'bank' ? 'del banco' : 'del libro contable'}`}>
                <thead><tr><th scope="col">ID</th><th scope="col">Motivo</th></tr></thead>
                <tbody>{exceptions.slice(0, 50).map(row => <tr key={row.id}><td>{row.id}</td><td>{exceptionLabels[row.reason]}</td></tr>)}</tbody>
              </table></div> : <p>Sin pendientes en esta comparación.</p>}
              {exceptions.length > 50 ? <p>Vista previa: 50 de {exceptions.length}. La descarga JSON contiene todas.</p> : null}
            </section>;
          })}
        </section>
      ) : <div className="empty-state" role="status"><strong>No hay una comparación preparada</strong><span>Importa ambos archivos y selecciona Comparar movimientos.</span></div>}
    </div>
  );
}
