import { Link } from 'react-router-dom';

export function RouteErrorPage() {
  return <section className="page-stack"><header className="page-header"><p className="eyebrow">Navigation</p><h1>Route not found</h1><p>This route is not part of the active ATLAS module graph.</p></header><Link className="text-link" to="/">Return home</Link></section>;
}
