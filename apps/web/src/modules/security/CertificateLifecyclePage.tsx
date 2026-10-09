import { useState } from 'react';
import './certificate-lifecycle.css';

type Phase = { title: string; subtitle: string; detail: string; owner: string };
const phases: Phase[] = [
  { title: 'Auditoría de certificados', subtitle: 'Descubrir y registrar', detail: 'Inventariar endpoints, cadenas de confianza, emisor, SAN, usos de clave, propietarios y vencimientos sin leer ni registrar claves privadas.', owner: 'Security · Cloud' },
  { title: 'Detectar incompatibilidades', subtitle: 'Identificar riesgos P0', detail: 'Separar identidades cliente/servidor, detectar uso dual y validar restricciones de CA y mTLS por cada proveedor.', owner: 'Security · Integrations' },
  { title: 'Diseñar rotación segura', subtitle: 'Planificar renovaciones', detail: 'Crear políticas por proveedor, alarmas anticipadas, solapamiento permitido de certificados y rutas de recuperación.', owner: 'Security · Operations' },
  { title: 'Implementación y pruebas', subtitle: 'Validar sin riesgos', detail: 'Probar handshakes positivos y negativos, expiración simulada, cambio de CA, revocación y fallos de red.', owner: 'Engineering · QA' },
  { title: 'Integración en ATLAS', subtitle: 'Conectar los módulos', detail: 'Unificar inventario y evidencia con ATLAS Cloud, conectores gubernamentales, pagos, APIs y auditoría.', owner: 'Platform · DevSecOps' },
  { title: 'Verificación de producción', subtitle: 'Certificar con evidencia', detail: 'Exigir CI, controles P0, SHA exacto desplegado y resultados de handshake autenticados antes de marcar VERIFIED.', owner: 'Release · Security' }
];
const modules = ['ATLAS Tax', 'Accounting', 'Payroll', 'Finance', 'Commerce', 'HR', 'ATLAS Pay', 'Conectores externos', 'Cloud'];

function LockShield() {
  return (
    <svg className="clm-shield" viewBox="0 0 340 370" role="img" aria-label="Escudo de seguridad ATLAS con candado">
      <defs>
        <linearGradient id="clm-shield-fill" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#74dcff"/><stop offset=".52" stopColor="#1568cf"/><stop offset="1" stopColor="#092c75"/></linearGradient>
        <linearGradient id="clm-lock-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#efffff"/><stop offset="1" stopColor="#3ab7ff"/></linearGradient>
      </defs>
      <path d="M170 12 307 78v104c0 85-57 143-137 178C90 325 33 267 33 182V78Z" fill="url(#clm-shield-fill)" stroke="#9eeaff" strokeWidth="8"/>
      <path d="M170 34 283 91v88c0 69-44 123-113 156C101 302 57 248 57 179V91Z" fill="#05295d" fillOpacity=".78" stroke="#56d7ff" strokeOpacity=".8" strokeWidth="3"/>
      <path d="M114 168v-27a56 56 0 0 1 112 0v27" fill="none" stroke="url(#clm-lock-fill)" strokeWidth="22" strokeLinecap="round"/>
      <rect x="91" y="165" width="158" height="125" rx="24" fill="url(#clm-lock-fill)"/>
      <circle cx="170" cy="217" r="13" fill="#064782"/><path d="M170 224v29" stroke="#064782" strokeWidth="12" strokeLinecap="round"/>
    </svg>
  );
}
export function CertificateLifecyclePage() {
  const [selected, setSelected] = useState(0);
  return (
    <section className="clm-page" aria-labelledby="clm-title">
      <div className="clm-top-grid">
        <header className="clm-hero">
          <div className="clm-hero-heading">
            <p className="clm-kicker">ATLAS ENTERPRISE SUITE · GLOBAL SECURITY INITIATIVE</p>
            <h1 id="clm-title">Certificate Lifecycle <span>&amp; Trust Management</span></h1>
            <p>Protegemos las conexiones e integraciones de ATLAS en todo el mundo.</p>
            <div className="clm-principles" aria-label="Principios de seguridad">
              <span>◈ Zero Trust</span><span>▣ Fail-closed</span><span>✓ 777 REVIEW</span><span>◎ Compliance global</span>
            </div>
          </div>
          <div className="clm-planet" aria-hidden="true"><span className="clm-orbit clm-orbit-one" /><span className="clm-orbit clm-orbit-two" /></div>
          <div className="clm-hero-visual"><LockShield /><div className="clm-platform-label">ATLAS <small>ENTERPRISE SUITE</small></div></div>
          <div className="clm-constellation" aria-label="Integraciones previstas, sin conexiones confirmadas">
            <span>Salesforce</span><span>MuleSoft</span><span>Government APIs</span><span>Banks &amp; Finance</span><span>Global Integrations</span>
          </div>
          <p className="clm-hero-disclaimer">Integraciones ilustrativas · Ninguna conexión mTLS se considera verificada sin evidencia.</p>
        </header>
        <aside className="clm-aside">
          <article className="clm-panel clm-objective"><h2>◎ Objetivo</h2><p>Gestionar con seguridad el ciclo de vida de certificados de ATLAS, conforme a las políticas de cada proveedor y los estándares aplicables.</p></article>
          <article className="clm-panel"><h2>Principales cambios de Salesforce</h2>
            <div className="clm-change"><span className="clm-change-icon danger">⌁</span><div><strong>Fin del doble uso</strong><p>Separar identidades cliente y servidor. Validar mTLS y la CA admitida por integración.</p></div><b className="clm-level urgent">P0</b></div>
            <div className="clm-change"><span className="clm-change-icon caution">⌛</span><div><strong>Certificados de menor vigencia</strong><p>Planificar renovaciones frecuentes; objetivo público de 47 días en marzo de 2029.</p></div><b className="clm-level">P1</b></div>
            <div className="clm-change"><span className="clm-change-icon">✧</span><div><strong>Root CAs y trust stores</strong><p>Actualizar confianza pública compatible, sin ampliar arbitrariamente la PKI privada.</p></div><b className="clm-level">P1</b></div>
          </article>
          <article className="clm-panel clm-reality" role="status"><h2>Estado operativo de ATLAS</h2><p><strong>No verificado.</strong> No existe un inventario autenticado de certificados conectado a esta pantalla.</p><p>No se han ejecutado rotaciones desde este panel.</p></article>
        </aside>
      </div>

      <section className="clm-panel clm-workflow" aria-labelledby="clm-workflow-title">
        <div className="clm-section-heading"><h2 id="clm-workflow-title">Plan de ejecución</h2><span>6 fases · estado sin verificar</span></div>
        <div className="clm-phase-grid" role="group" aria-label="Seleccionar etapa del plan">
          {phases.map((phase, index) => (
            <button type="button" key={phase.title} className={'clm-phase ' + (selected === index ? 'is-selected' : '')} onClick={() => setSelected(index)} aria-pressed={selected === index}>
              <span className="clm-phase-number">{index + 1}</span><strong>{phase.title}</strong><small>{phase.subtitle}</small><span className="clm-unverified">Pendiente de evidencia</span>
            </button>
          ))}
        </div>
        <div className="clm-phase-detail" aria-live="polite"><strong>Fase {selected + 1} · {phases[selected].title}</strong><p>{phases[selected].detail}</p><small>Responsables previstos: {phases[selected].owner}</small></div>
      </section>

      <div className="clm-bottom-grid">
        <section className="clm-panel" aria-labelledby="clm-module-title"><h2 id="clm-module-title">Módulos ATLAS involucrados</h2><div className="clm-module-grid">{modules.map((name) => <span key={name}>{name}</span>)}</div><p className="clm-muted">Alcance de integración planificado; no indica que los conectores estén activos.</p></section>
        <section className="clm-panel" aria-labelledby="clm-calendar-title"><h2 id="clm-calendar-title">Horizonte de reducción de vigencia TLS</h2>
          <ol className="clm-timeline"><li><strong>Marzo 2026</strong><span>Hasta 200 días</span></li><li><strong>Marzo 2027</strong><span>Hasta 100 días</span></li><li><strong>Marzo 2029</strong><span>Hasta 47 días</span></li></ol>
          <p className="clm-muted">Referencias de planificación para certificados TLS públicos; confirmar exigencias y fechas del proveedor antes de automatizar.</p></section>
      </div>
      <footer className="clm-panel clm-footer"><div><strong>ATLAS 777 REVIEW</strong><p>Especificación registrada en GitHub; implementación y producción no certificadas.</p></div><a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/730" target="_blank" rel="noopener noreferrer">Revisar PR #730 ↗</a><span className="clm-footer-state">PRODUCCIÓN: SIN VERIFICAR</span></footer>
    </section>
  );
}
