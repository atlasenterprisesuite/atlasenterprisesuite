import { Link } from 'react-router-dom';

export function HealthModuleCard({ title, description, to }: { title: string; description: string; to: string }) {
  return <Link className="health-module-card" to={to}><span className="health-module-icon" aria-hidden="true">◇</span><span><strong>{title}</strong><small>{description}</small></span><span className="health-module-arrow" aria-hidden="true">→</span></Link>;
}
