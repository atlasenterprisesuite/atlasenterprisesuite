import { Link } from 'react-router-dom';
import { HealthDataNotice } from './shared/HealthDataNotice';

export function HealthWorkspaceLanding({
  title,
  description,
  primaryTo,
  primaryLabel,
  notice
}: {
  title: string;
  description: string;
  primaryTo: string;
  primaryLabel: string;
  notice?: string;
}) {
  return (
    <section className="page-stack health-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <HealthDataNotice state="demo" text={notice ?? 'This workspace is using governed demonstration state until an authorized live source is configured.'} />
      <Link className="module-card enabled single-card" to={primaryTo}>
        <span>Continue</span>
        <strong>{primaryLabel}</strong>
        <p>Open the next governed route in this Health workflow.</p>
      </Link>
    </section>
  );
}
