import { Outlet } from 'react-router-dom';
import { OperationsNav } from './OperationsNav';

export function OperationsLayout() {
  return (
    <section className="page-stack health-page operations-workspace">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health</p>
        <h1>Health Operations</h1>
        <p>One governed operations workspace across command, modules, source state, permissions, integrations and audit-aware workflows.</p>
      </header>
      <OperationsNav />
      <Outlet />
    </section>
  );
}
