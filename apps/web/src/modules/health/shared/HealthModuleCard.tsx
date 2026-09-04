import { Link } from 'react-router-dom';

export function HealthModuleCard({ title, description, to, eyebrow = 'ATLAS Health' }: { title: string; description: string; to: string; eyebrow?: string }) {
  return (
    <Link className="module-card enabled" to={to}>
      <span>{eyebrow}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </Link>
  );
}
