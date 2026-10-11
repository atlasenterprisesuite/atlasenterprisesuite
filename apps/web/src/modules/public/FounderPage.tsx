import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './founder-page.css';

const TITLE = 'Winder Aranguren | ATLAS Enterprise Suite';
const CANONICAL_URL = 'https://www.atlasenterprisesuite.com/about/founder';
const DESCRIPTION = 'Conoce a Winder Aranguren, profesional de contabilidad y administración con más de ocho años de experiencia y fundador del proyecto tecnológico ATLAS Enterprise Suite.';

export function FounderPage() {
  useEffect(() => {
    const originalTitle = document.title;
    const inserted: HTMLElement[] = [];

    document.title = TITLE;

    const addMeta = (key: 'name' | 'property', field: string, content: string) => {
      const meta = document.createElement('meta');
      meta.setAttribute(key, field);
      meta.setAttribute('content', content);
      meta.setAttribute('data-atlas-founder', '');
      document.head.appendChild(meta);
      inserted.push(meta);
    };

    addMeta('name', 'description', DESCRIPTION);
    addMeta('name', 'robots', 'index, follow');
    addMeta('property', 'og:type', 'profile');
    addMeta('property', 'og:title', TITLE);
    addMeta('property', 'og:description', DESCRIPTION);
    addMeta('property', 'og:url', CANONICAL_URL);

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = CANONICAL_URL;
    canonical.setAttribute('data-atlas-founder', '');
    document.head.appendChild(canonical);
    inserted.push(canonical);

    const structuredData = document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.setAttribute('data-atlas-founder', '');
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Winder Aranguren',
      url: CANONICAL_URL,
      jobTitle: 'Fundador del proyecto ATLAS Enterprise Suite',
      description: DESCRIPTION,
      knowsAbout: ['Contabilidad', 'Accounts Receivable', 'Payroll', 'Recursos Humanos', 'Automatización empresarial'],
      affiliation: {
        '@type': 'Organization',
        name: 'ATLAS Enterprise Suite',
        url: 'https://www.atlasenterprisesuite.com'
      }
    });
    document.head.appendChild(structuredData);
    inserted.push(structuredData);

    return () => {
      document.title = originalTitle;
      inserted.forEach((element) => element.remove());
    };
  }, []);

  return (
    <article className="atlas-founder-page page-stack">
      <header className="atlas-founder-hero">
        <div className="atlas-founder-hero__content">
          <p className="eyebrow">ATLAS Enterprise Suite · La persona detrás de la visión</p>
          <h1>Winder Aranguren</h1>
          <p className="atlas-founder-hero__role">Contabilidad · Administración · Tecnología empresarial</p>
          <p className="atlas-founder-hero__lead">
            Fundador e impulsor del proyecto ATLAS Enterprise Suite, una visión para conectar personas,
            procesos y tecnología en un ecosistema empresarial accesible y escalable.
          </p>
          <nav className="atlas-founder-actions" aria-label="Explorar ATLAS y sus fuentes públicas">
            <Link className="atlas-founder-actions__primary" to="/">Explorar ATLAS <span aria-hidden="true">→</span></Link>
            <a
              className="atlas-founder-actions__secondary"
              href="https://github.com/atlasenterprisesuite/atlasenterprisesuite"
              target="_blank"
              rel="noopener noreferrer"
            >
              Repositorio oficial <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
        <div className="atlas-founder-hero__monogram" role="img" aria-label="Monograma WA; no es una fotografía personal">
          <span>WA</span>
          <small>FOUNDER · ATLAS</small>
        </div>
      </header>

      <section className="atlas-founder-section" aria-labelledby="founder-story">
        <p className="eyebrow">Perfil profesional</p>
        <h2 id="founder-story">Experiencia que conecta operaciones y futuro</h2>
        <p>
          Winder Aranguren es un profesional de contabilidad y administración con más de ocho años de experiencia
          en operaciones financieras, cuentas por cobrar, nómina, recursos humanos y gestión empresarial.
        </p>
        <p>
          Su trayectoria comprende conciliaciones, facturación, controles internos y herramientas de gestión
          financiera, con experiencia profesional en Venezuela y Estados Unidos.
        </p>
      </section>

      <section className="atlas-founder-section" aria-labelledby="founder-vision">
        <p className="eyebrow">Visión</p>
        <h2 id="founder-vision">Muchas ideas. Una plataforma.</h2>
        <p>
          ATLAS Enterprise Suite es un proyecto tecnológico que busca reunir inteligencia artificial,
          automatización, herramientas financieras y servicios digitales en un sistema coherente.
          Su desarrollo es progresivo: las capacidades sujetas a integración o validación no se presentan
          como servicios disponibles hasta contar con evidencia técnica.
        </p>
        <div className="atlas-founder-pillars">
          <div><strong>Personas</strong><span>Tecnología accesible y comunicación sin barreras.</span></div>
          <div><strong>Empresa</strong><span>Operaciones financieras y administrativas conectadas.</span></div>
          <div><strong>Innovación</strong><span>Automatización responsable y soluciones verificables.</span></div>
        </div>
      </section>

      <footer className="atlas-founder-footer">
        <p>Perfil institucional del proyecto ATLAS Enterprise Suite. Sin datos de contacto personales ni redes sociales no verificadas.</p>
        <Link to="/">Volver al inicio <span aria-hidden="true">→</span></Link>
      </footer>
    </article>
  );
}
