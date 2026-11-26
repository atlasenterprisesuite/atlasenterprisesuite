import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assessVersePreflight, parseVerseChecks, type VerseEnvironment, type VerseProvider, type VerseState } from './versePreflight';

const states: readonly VerseState[] = ['unknown', 'pending', 'success', 'failure'];
const providers: readonly VerseProvider[] = ['cloudflare', 'vercel', 'supabase', 'self-hosted', 'other'];
const environments: readonly VerseEnvironment[] = ['preview', 'staging', 'production'];

export function AtlasVersePage() {
  const [expectedSha, setExpectedSha] = useState('');
  const [observedSha, setObservedSha] = useState('');
  const [deploymentId, setDeploymentId] = useState('');
  const [provider, setProvider] = useState<VerseProvider>('cloudflare');
  const [environment, setEnvironment] = useState<VerseEnvironment>('production');
  const [build, setBuild] = useState<VerseState>('unknown');
  const [runtime, setRuntime] = useState<VerseState>('unknown');
  const [checkText, setCheckText] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [copyState, setCopyState] = useState('');

  function evaluate() {
    setCopyState('');
    const parsed = parseVerseChecks(checkText);
    if (parsed.errors.length) {
      setReport(JSON.stringify({ source: 'operator_input', status: 'blocked', errors: parsed.errors, productionVerified: false }, null, 2));
      return;
    }
    const input = { expectedSha, observedSha, deploymentId, environment, provider, build, runtime, checks: parsed.checks };
    const result = assessVersePreflight(input);
    setReport(JSON.stringify({ input, ...result }, null, 2));
  }

  function reset() {
    setExpectedSha(''); setObservedSha(''); setDeploymentId('');
    setProvider('cloudflare'); setEnvironment('production');
    setBuild('unknown'); setRuntime('unknown'); setCheckText('');
    setReport(null); setCopyState('');
  }

  async function copyReport() {
    if (!report || !navigator.clipboard?.writeText) {
      setCopyState('La copia automática no está disponible; selecciona el texto del informe.');
      return;
    }
    try {
      await navigator.clipboard.writeText(report);
      setCopyState('Informe copiado.');
    } catch {
      setCopyState('No se pudo copiar automáticamente. Selecciona el informe.');
    }
  }

  let parsedReport: { status?: string; blockers?: string[]; warnings?: string[]; errors?: string[]; notice?: string } | null = null;
  if (report) {
    try { parsedReport = JSON.parse(report); } catch { parsedReport = null; }
  }

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Herramientas propias · 777 REVIEW</p>
        <h1>ATLAS Verse</h1>
        <p>Preflight soberano de despliegues. Clasifica comprobaciones obligatorias y opcionales sin depender del estado histórico de Vercel Hobby. Este diagnóstico se ejecuta en tu navegador, sin enviar los campos a servicios externos.</p>
      </header>

      <div className="atlas-cloud-action-row">
        <Link to="/cloud/releases">Release Control</Link>
        <Link to="/cloud/production-verification">Verificación de producción</Link>
        <Link to="/execution/manager/readiness">ATLAS Manager</Link>
      </div>

      <section className="atlas-cloud-policy-grid" aria-label="Información de Verse">
        <article><strong>Autoridad</strong><p>GitHub → Supabase ATLAS Manager → Cloudflare</p></article>
        <article><strong>Vercel</strong><p>Proveedor opcional. Un check heredado no sustituye ni invalida las verificaciones obligatorias de ATLAS.</p></article>
        <article><strong>Datos</strong><p>No pegues credenciales, datos personales ni secretos. El análisis manual no demuestra autenticidad del proveedor.</p></article>
        <article><strong>Estado real</strong><p>Sin evaluación automática ni despliegue desde esta pantalla. Las promociones siguen bajo los controles existentes.</p></article>
      </section>

      <form onSubmit={(event) => { event.preventDefault(); evaluate(); }} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <label>SHA esperado (40 caracteres)
            <input aria-label="SHA esperado" value={expectedSha} onChange={(e) => { setExpectedSha(e.target.value.trim()); setReport(null); }} placeholder="Commit exacto de origen" maxLength={40} style={{ display: 'block', width: '100%' }} />
          </label>
          <label>SHA observado
            <input aria-label="SHA observado" value={observedSha} onChange={(e) => { setObservedSha(e.target.value.trim()); setReport(null); }} placeholder="SHA informado por runtime" maxLength={40} style={{ display: 'block', width: '100%' }} />
          </label>
          <label>ID de despliegue
            <input aria-label="ID de despliegue" value={deploymentId} onChange={(e) => { setDeploymentId(e.target.value); setReport(null); }} placeholder="ID real de evidencia" maxLength={120} style={{ display: 'block', width: '100%' }} />
          </label>
          <label>Entorno
            <select value={environment} onChange={(e) => { setEnvironment(e.target.value as VerseEnvironment); setReport(null); }} style={{ display: 'block', width: '100%' }}>
              {environments.map(value => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>Proveedor
            <select value={provider} onChange={(e) => { setProvider(e.target.value as VerseProvider); setReport(null); }} style={{ display: 'block', width: '100%' }}>
              {providers.map(value => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>Compilación
            <select value={build} onChange={(e) => { setBuild(e.target.value as VerseState); setReport(null); }} style={{ display: 'block', width: '100%' }}>
              {states.map(value => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>Runtime
            <select value={runtime} onChange={(e) => { setRuntime(e.target.value as VerseState); setReport(null); }} style={{ display: 'block', width: '100%' }}>
              {states.map(value => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <label>Checks del commit (uno por línea: required|nombre|success)
          <textarea aria-label="Checks de GitHub" value={checkText} onChange={(e) => { setCheckText(e.target.value); setReport(null); }} rows={6} maxLength={9000} placeholder={'required|verify-build-readiness|success\nrequired|github-security-baseline|success\noptional|Vercel – atlas_enterprise_suite|failure'} style={{ display: 'block', width: '100%' }} />
        </label>
        <p>Los ejemplos del formulario son sólo instrucciones de formato, no evidencia de checks realizados. Verifica cuáles son obligatorios en las reglas actuales de GitHub.</p>
        <div className="atlas-cloud-action-row">
          <button type="submit">Evaluar gates P0/P1</button>
          <button type="button" onClick={reset}>Limpiar</button>
        </div>
      </form>

      <section aria-live="polite">
        {report && parsedReport ? (
          <div className={parsedReport.status === 'blocked' ? 'atlas-cloud-state error' : 'atlas-cloud-state'}>
            <strong>{parsedReport.status === 'candidate_only' ? 'Preflight candidato · NO certifica producción' : 'P0 NO-GO · Evidencia insuficiente'}</strong>
            {parsedReport.notice ? <p>{parsedReport.notice}</p> : null}
            {[...(parsedReport.errors || []), ...(parsedReport.blockers || [])].map((message, index) => <p key={index}>{message}</p>)}
            {(parsedReport.warnings || []).map((message, index) => <p key={index}>P1: {message}</p>)}
          </div>
        ) : null}
        {report ? (
          <>
            <label htmlFor="atlas-verse-report">Informe JSON local (sin firma, no autorizado como comprobante externo)</label>
            <textarea id="atlas-verse-report" value={report} readOnly rows={12} style={{ display: 'block', width: '100%' }} />
            <div className="atlas-cloud-action-row"><button type="button" onClick={() => void copyReport()}>Copiar informe</button></div>
            {copyState ? <p role="status">{copyState}</p> : null}
          </>
        ) : null}
      </section>
      <p className="atlas-cloud-truth-note">Verse v1 nunca despliega, compra recursos, lee secretos ni declara producción verificada. El estado autorizado debe provenir de Release Control, ATLAS Manager y la verificación E2E exact-SHA.</p>
    </section>
  );
}
