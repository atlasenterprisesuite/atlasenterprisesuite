import { Link } from 'react-router-dom';

export function RouteErrorPage() {
  return (
    <main className="atlas-page">
      <p className="atlas-eyebrow">Navigation</p>
      <h1>Route not found</h1>
      <p>This route is not part of the current ATLAS application baseline.</p>
      <Link to="/">Return home</Link>
    </main>
  );
}
