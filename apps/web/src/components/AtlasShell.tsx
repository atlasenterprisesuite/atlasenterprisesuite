import type { PropsWithChildren } from 'react';
import { Link, NavLink } from 'react-router-dom';

export function AtlasShell({ children }: PropsWithChildren) {
  return (
    <div className="atlas-shell">
      <a className="skip-link" href="#atlas-main">Skip to content</a>
      <header className="atlas-header">
        <Link className="atlas-brand" to="/" aria-label="ATLAS Enterprise Suite home">
          <span className="atlas-mark" aria-hidden="true">A</span>
          <span>ATLAS</span>
        </Link>
        <nav className="atlas-primary-nav" aria-label="Primary navigation">
          <NavLink to="/" end>Enterprise</NavLink>
          <NavLink to="/health">Health</NavLink>
        </nav>
      </header>
      <main id="atlas-main" className="atlas-main">{children}</main>
    </div>
  );
}
