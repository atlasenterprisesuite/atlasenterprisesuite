import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ModuleExperienceCard = {
  label: string;
  title: string;
  description: string;
  to?: string;
  status?: string;
};

export type ModuleExperienceSection = {
  eyebrow: string;
  title: string;
  description: string;
  cards: ModuleExperienceCard[];
};

export type ModuleExperienceAction = {
  label: string;
  to: string;
  variant?: 'primary' | 'secondary';
};

type ModuleExperiencePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  narrative?: string;
  actions?: ModuleExperienceAction[];
  sections: ModuleExperienceSection[];
  statusNote?: string;
  children?: ReactNode;
};

function ExperienceCard({ card }: { card: ModuleExperienceCard }) {
  const content = (
    <>
      <span className="module-experience-card-label">{card.label}</span>
      <strong>{card.title}</strong>
      <p>{card.description}</p>
      {card.status ? <small className="module-experience-card-status">{card.status}</small> : null}
      {card.to ? <span className="module-experience-card-action">Open capability <span aria-hidden="true">↗</span></span> : null}
    </>
  );

  if (card.to) {
    return (
      <Link className="module-experience-card is-active" to={card.to}>
        {content}
      </Link>
    );
  }

  return (
    <article className="module-experience-card is-gated" aria-disabled="true">
      {content}
    </article>
  );
}

export function ModuleExperiencePage({
  eyebrow,
  title,
  description,
  narrative,
  actions = [],
  sections,
  statusNote,
  children
}: ModuleExperiencePageProps) {
  return (
    <section className="module-experience-page">
      <header className="module-experience-hero">
        <div className="module-experience-hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="module-experience-description">{description}</p>
          {narrative ? <p className="module-experience-narrative">{narrative}</p> : null}
          {actions.length > 0 ? (
            <nav className="module-experience-actions" aria-label={`${title} actions`}>
              {actions.map((action) => (
                <Link
                  key={`${action.to}-${action.label}`}
                  className={`module-experience-action ${action.variant === 'secondary' ? 'secondary' : 'primary'}`}
                  to={action.to}
                >
                  {action.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="module-experience-orbit" aria-hidden="true">
          <span className="orbit-core">A</span>
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <span className="orbit-node orbit-node-cyan" />
          <span className="orbit-node orbit-node-orange" />
        </div>
      </header>

      {children}

      <div className="module-experience-sections">
        {sections.map((section, index) => (
          <section className="module-experience-section" key={`${section.eyebrow}-${section.title}`}>
            <div className="module-experience-section-heading">
              <span className="module-experience-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
            </div>
            <div className="module-experience-grid">
              {section.cards.map((card) => <ExperienceCard key={`${card.label}-${card.title}`} card={card} />)}
            </div>
          </section>
        ))}
      </div>

      {statusNote ? <div className="module-experience-truth" role="note">{statusNote}</div> : null}
    </section>
  );
}
