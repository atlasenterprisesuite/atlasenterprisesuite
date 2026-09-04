import { Link } from 'react-router-dom';

export function HealthWorkspaceLanding({ title, description, primaryTo, primaryLabel }: { title: string; description: string; primaryTo: string; primaryLabel: string }) {
  return <section className="health-page health-stack"><p className="eyebrow">ATLAS Health</p><h1>{title}</h1><p className="health-copy">{description}</p><Link className="health-primary-action" to={primaryTo}>{primaryLabel}</Link></section>;
}
