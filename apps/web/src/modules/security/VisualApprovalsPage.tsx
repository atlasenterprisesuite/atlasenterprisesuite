import { useState } from 'react';
import './visual-approvals.css';

type Scenario = { id: string; label: string; priority: string; structured: boolean; tenant: string; security: string; production: string; inferred: boolean };
export const scenarios: Scenario[] = [
  { id: 'legacy', label: 'Legacy issue #908', priority: 'P0', structured: false, tenant: '', security: '', production: '', inferred: true },
  { id: 'safe', label: 'Structured feature P2', priority: 'P2', structured: true, tenant: 'No', security: 'No', production: 'No', inferred: false },
  { id: 'missing', label: 'Incomplete security answers', priority: 'P2', structured: true, tenant: '', security: '', production: '', inferred: false },
  { id: 'production', label: 'Production change P1', priority: 'P1', structured: true, tenant: 'No', security: 'No', production: 'Yes', inferred: false },
];
export function evaluateScenario(s: Scenario) {
  const sensitive = s.priority === 'P0' || s.tenant === 'Yes' || s.security === 'Yes' || s.production === 'Yes';
  const autoEligible = s.structured && !s.inferred && !sensitive && s.tenant === 'No' && s.security === 'No' && s.production === 'No';
  return { sensitive, autoEligible, reason: s.inferred ? 'Inferred metadata cannot authorize execution.' : sensitive ? 'P0 or sensitive change requires human review.' : !autoEligible ? 'Missing explicit No answers; fail closed.' : 'Eligible for governed routing only; no execution authorized.' };
}
const targetSha = '7540f79486811d13d1671a735a303b03923441f5';
export function VisualApprovalsPage() {
  const [id, setId] = useState('legacy');
  const [view, setView] = useState<'before' | 'after'>('after');
  const s = scenarios.find(item => item.id === id) ?? scenarios[0];
  const result = evaluateScenario(s);
  return <main className="va-page">
    <header className="va-hero"><p className="eyebrow">ATLAS 777 · READ-ONLY PROTOTYPE</p><h1>Centro de Aprobaciones Visuales</h1><p>Inspecciona el comportamiento propuesto antes de autorizar cambios. Esta pantalla usa escenarios sintéticos, no datos en vivo.</p><div className="va-chips"><span>PR #914</span><span>SHA {targetSha.slice(0, 12)}</span><span>Sin merge ni deploy</span></div></header>
    <section className="va-panel"><h2>1. Simular clasificación</h2><label htmlFor="va-scenario">Escenario</label><select id="va-scenario" value={id} onChange={e => setId(e.target.value)}>{scenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <div className="va-compare"><button type="button" aria-pressed={view === 'before'} onClick={() => setView('before')}>Antes · intake legacy</button><button type="button" aria-pressed={view === 'after'} onClick={() => setView('after')}>Después · PR #914</button></div>
      {view === 'before' ? <div className="va-result"><strong>Antes (modelo ilustrativo)</strong><p>Las incidencias sin campos estructurados se enviaban a revisión humana, sin clasificación inferida.</p></div> : <div className="va-result" role="status"><strong>{result.autoEligible ? 'Elegible para enrutamiento gobernado' : 'Revisión humana obligatoria'}</strong><p>{result.reason}</p><dl><div><dt>Prioridad</dt><dd>{s.priority}</dd></div><div><dt>Metadatos inferidos</dt><dd>{s.inferred ? 'Sí' : 'No'}</dd></div><div><dt>Seguridad</dt><dd>{s.security || 'Sin respuesta'}</dd></div><div><dt>Producción</dt><dd>{s.production || 'Sin respuesta'}</dd></div></dl></div>}
    </section>
    <section className="va-panel"><h2>2. Evidencia y permisos</h2><p>Referencia de código: <code>{targetSha}</code></p><p>Las verificaciones CI 7/7 fueron observadas para este SHA; esta demostración no consulta GitHub en tiempo real ni certifica RBAC/RLS.</p><ul><li>Identidad de acceso: protegida por RequireAtlasIdentity en la ruta.</li><li>RBAC de aprobación: no implementado; acción bloqueada.</li><li>Auditoría persistente: no implementada; no se escribe ninguna aprobación.</li><li>Integridad SHA y revisión independiente: pendientes de validación externa.</li></ul><a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/914/files" target="_blank" rel="noopener noreferrer">Examinar cambios reales del PR #914</a></section>
    <section className="va-panel va-locked"><h2>3. Decisión</h2><p>No es posible aprobar, fusionar o desplegar desde este prototipo.</p><button type="button" disabled aria-disabled="true">Aprobar integración — bloqueado</button><p role="note">P0 abierto hasta evidencia independiente de autorización, RBAC, RLS y auditoría.</p></section>
  </main>;
}
