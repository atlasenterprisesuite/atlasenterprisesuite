import { Link } from 'react-router-dom';
import './public-home.css';

const pillars = [
  ['Intelligence', 'AI-assisted workflows and decision support across the ATLAS ecosystem.'],
  ['Operations', 'One governed entry point for business, people, finance, mobility and connected systems.'],
  ['Trust', 'Identity, permissions, auditability and explicit evidence boundaries by design.']
] as const;

export function PublicHome() {
  return (
    <main className="public-home">
      <header className="public-nav" aria-label="ATLAS public navigation">
        <Link className="public-brand" to="/" aria-label="ATLAS Enterprise Suite home">
          <span className="public-brand-mark" aria-hidden="true">A</span>
          <span><strong>ATLAS</strong><small>ENTERPRISE SUITE</small></span>
        </Link>

        <nav className="public-nav-links" aria-label="Primary">
          <a href="#platform">Platform</a>
          <a href="#vision">Vision</a>
          <a href="#enterprise">Enterprise</a>
          <a href="#about">About</a>
        </nav>

        <div className="public-nav-actions">
          <Link className="public-link-button" to="/identity">Sign in</Link>
          <Link className="public-primary-button compact" to="/platform">Enter ATLAS</Link>
        </div>
      </header>

      <section className="public-hero" aria-labelledby="atlas-hero-title">
        <div className="public-hero-copy">
          <p className="public-kicker">ATLAS ENTERPRISE SUITE</p>
          <h1 id="atlas-hero-title">
            One intelligent platform.
            <span> Your world, connected.</span>
          </h1>
          <p className="public-hero-lead">
            ATLAS is being built as a unified operating environment for organizations:
            connecting people, processes, intelligence and governed digital operations
            without forcing the public home page to look like an application launcher.
          </p>

          <div className="public-hero-actions">
            <Link className="public-primary-button" to="/platform">Explore the platform</Link>
            <a className="public-secondary-button" href="#vision">See the vision</a>
          </div>

          <div className="public-hero-meta" aria-label="ATLAS principles">
            <span>Unified</span>
            <span>Governed</span>
            <span>Adaptive</span>
            <span>Enterprise-ready</span>
          </div>
        </div>

        <div className="public-hero-visual" aria-label="ATLAS connected ecosystem visualization">
          <div className="public-orbit orbit-one" aria-hidden="true" />
          <div className="public-orbit orbit-two" aria-hidden="true" />
          <div className="public-orbit orbit-three" aria-hidden="true" />

          <div className="public-core">
            <img src="/atlas-avatar-particle.svg" alt="" aria-hidden="true" />
            <div>
              <strong>ATLAS</strong>
              <span>Enterprise Intelligence</span>
            </div>
          </div>

          <div className="public-node node-one"><span>AI</span><small>Intelligence</small></div>
          <div className="public-node node-two"><span>01</span><small>Operations</small></div>
          <div className="public-node node-three"><span>∞</span><small>Connected</small></div>
          <div className="public-node node-four"><span>✓</span><small>Governed</small></div>

          <div className="public-visual-caption">
            <span className="public-live-dot" aria-hidden="true" />
            <span>One ecosystem. Multiple capabilities. One entry point.</span>
          </div>
        </div>
      </section>

      <section className="public-intro-strip" id="platform" aria-label="ATLAS platform introduction">
        <p>BUSINESS</p><span>•</span>
        <p>INTELLIGENCE</p><span>•</span>
        <p>FINANCE</p><span>•</span>
        <p>PEOPLE</p><span>•</span>
        <p>MOBILITY</p><span>•</span>
        <p>CONNECTED SYSTEMS</p>
      </section>

      <section className="public-section" id="vision">
        <div className="public-section-heading">
          <p className="public-kicker">THE ATLAS VISION</p>
          <h2>Start with the mission, not a wall of modules.</h2>
          <p>
            The public experience introduces what ATLAS is, how the ecosystem connects and
            why it exists. Detailed applications remain inside the governed product environment.
          </p>
        </div>

        <div className="public-pillar-grid">
          {pillars.map(([title, description]) => (
            <article className="public-pillar-card" key={title}>
              <span className="public-pillar-index">0{pillars.findIndex(([name]) => name === title) + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section public-enterprise-section" id="enterprise">
        <div>
          <p className="public-kicker">FROM WEBSITE TO OPERATING ENVIRONMENT</p>
          <h2>A clear front door. A powerful system behind it.</h2>
        </div>
        <div className="public-enterprise-copy">
          <p>
            Visitors first understand ATLAS as a company and platform. Authenticated users
            then move into the product shell, where permitted modules, workflows and data
            become available according to their organization and role.
          </p>
          <Link className="public-text-link" to="/platform">Open platform entry →</Link>
        </div>
      </section>

      <footer className="public-footer" id="about">
        <div className="public-brand footer-brand">
          <span className="public-brand-mark" aria-hidden="true">A</span>
          <span><strong>ATLAS</strong><small>ENTERPRISE SUITE</small></span>
        </div>
        <p>Built as a unified enterprise ecosystem.</p>
        <div>
          <Link to="/identity">Sign in</Link>
          <Link to="/platform">Platform</Link>
        </div>
      </footer>
    </main>
  );
}
