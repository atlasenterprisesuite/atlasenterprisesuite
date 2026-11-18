import { useState } from 'react';
import { Link } from 'react-router-dom';
import './public-home.css';

type Locale = 'es' | 'en';
const copy = {
  es: {
    platform:'Plataforma', vision:'Visión', enterprise:'Empresas', about:'Acerca de', signIn:'Iniciar sesión', enter:'Entrar a ATLAS',
    welcome:'Bienvenido a', tagline:'Un universo de posibilidades. Una plataforma conectada.',
    intro:'ATLAS Enterprise Suite reúne operaciones empresariales, asistencia de inteligencia artificial y conectividad entre dispositivos en un ecosistema diseñado para trabajar de forma integrada.',
    explore:'Explorar ATLAS', learn:'Conocer la visión',
    pillars:['Operaciones empresariales','IA y conocimiento','Dispositivos y conectividad'],
    details:[
      'Contabilidad, impuestos, nómina, relaciones con clientes y servicios de asesoría.',
      'ATLAS Assistant y Knowledge Atlas para consultar información y coordinar tareas autorizadas.',
      'Experiencias conectadas entre iPhone y Windows, sujetas a consentimiento y permisos explícitos.'
    ],
    visionTitle:'Una plataforma. Muchas capacidades. Una experiencia coherente.',
    visionBody:'ATLAS Manager está diseñado para coordinar flujos de trabajo, registrar autorizaciones y conservar evidencia verificable de los resultados.',
    enterpriseTitle:'Diseñado para evolucionar con confianza.',
    enterpriseBody:'Las funciones disponibles y las que siguen en desarrollo deben distinguirse claramente. ATLAS 777 REVIEW exige criterios de aceptación, pruebas y verificación de producción antes de declarar una capacidad lista.',
    status:'Las integraciones descritas son objetivos de producto; su disponibilidad requiere verificación independiente.',
    footer:'Un ecosistema empresarial conectado.'
  },
  en: {
    platform:'Platform', vision:'Vision', enterprise:'Enterprise', about:'About', signIn:'Sign in', enter:'Enter ATLAS',
    welcome:'Welcome to', tagline:'A universe of possibilities. One connected platform.',
    intro:'ATLAS Enterprise Suite brings business operations, AI assistance, and device connectivity into one ecosystem designed to work together.',
    explore:'Explore ATLAS', learn:'Discover the vision',
    pillars:['Business operations','AI and knowledge','Devices and connectivity'],
    details:[
      'Accounting, tax, payroll, customer relationships, and advisory services.',
      'ATLAS Assistant and Knowledge Atlas for finding information and coordinating authorized tasks.',
      'Connected experiences across iPhone and Windows, subject to explicit consent and permissions.'
    ],
    visionTitle:'One platform. Many capabilities. One coherent experience.',
    visionBody:'ATLAS Manager is designed to coordinate workflows, record authorizations, and retain verifiable evidence of outcomes.',
    enterpriseTitle:'Built to evolve with confidence.',
    enterpriseBody:'Available features must be distinguished from work still in development. ATLAS 777 REVIEW requires acceptance criteria, testing, and production verification before a capability is declared ready.',
    status:'The integrations described are product goals; availability requires independent verification.',
    footer:'A connected enterprise ecosystem.'
  }
} as const;

export function PublicHome() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof navigator === 'undefined') return 'en';
    return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  });
  const t = copy[locale];
  return (
    <main className="public-home" lang={locale}>
      <header className="public-nav">
        <Link className="public-brand" to="/" aria-label="ATLAS Enterprise Suite home">
          <span className="public-brand-mark" aria-hidden="true">A</span>
          <span><strong>ATLAS</strong><small>ENTERPRISE SUITE</small></span>
        </Link>
        <nav className="public-nav-links" aria-label="Primary">
          <a href="#platform">{t.platform}</a><a href="#vision">{t.vision}</a>
          <a href="#enterprise">{t.enterprise}</a><a href="#about">{t.about}</a>
        </nav>
        <div className="public-nav-actions">
          <label className="public-language-label" htmlFor="public-language">Language</label>
          <select id="public-language" className="public-language-select" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="es">Español</option><option value="en">English</option>
          </select>
          <Link className="public-link-button" to="/identity">{t.signIn}</Link>
          <Link className="public-primary-button compact" to="/platform">{t.enter}</Link>
        </div>
      </header>
      <section className="public-hero public-hero-cinematic" aria-labelledby="atlas-hero-title">
        <div className="public-cosmos" role="img" aria-label={locale === 'es' ? 'Universo ATLAS: planeta conectado y galaxias' : 'ATLAS universe: connected planet and galaxies'}>
          <div className="public-cosmos-planet" aria-hidden="true"/>
          <div className="public-cosmos-orbit public-cosmos-orbit-a" aria-hidden="true"/>
          <div className="public-cosmos-orbit public-cosmos-orbit-b" aria-hidden="true"/>
        </div>
        <div className="public-hero-copy">
          <p className="public-kicker">ATLAS ENTERPRISE SUITE</p>
          <h1 id="atlas-hero-title"><span className="public-welcome">{t.welcome}</span><span className="public-atlas-title">ATLAS</span></h1>
          <p className="public-hero-tagline">{t.tagline}</p>
          <p className="public-hero-lead">{t.intro}</p>
          <div className="public-hero-actions">
            <Link className="public-primary-button" to="/platform">{t.explore}</Link>
            <a className="public-secondary-button" href="#vision">{t.learn}</a>
          </div>
        </div>
      </section>
      <section className="public-section" id="platform">
        <div className="public-section-heading">
          <p className="public-kicker">ATLAS ENTERPRISE SUITE</p>
          <h2>{t.visionTitle}</h2><p>{t.visionBody}</p>
        </div>
        <div className="public-pillar-grid">
          {t.pillars.map((name,i) => <article className="public-pillar-card" key={name}>
            <span className="public-pillar-index">0{i+1}</span><h3>{name}</h3><p>{t.details[i]}</p>
          </article>)}
        </div>
      </section>
      <section className="public-section public-enterprise-section" id="enterprise">
        <div id="vision"><p className="public-kicker">ATLAS 777 REVIEW</p><h2>{t.enterpriseTitle}</h2></div>
        <div className="public-enterprise-copy"><p>{t.enterpriseBody}</p><p className="public-availability-note">{t.status}</p></div>
      </section>
      <footer className="public-footer" id="about">
        <div className="public-brand footer-brand"><span className="public-brand-mark" aria-hidden="true">A</span><span><strong>ATLAS</strong><small>ENTERPRISE SUITE</small></span></div>
        <p>{t.footer}</p><div><Link to="/identity">{t.signIn}</Link><Link to="/platform">{t.platform}</Link></div>
      </footer>
    </main>
  );
}
