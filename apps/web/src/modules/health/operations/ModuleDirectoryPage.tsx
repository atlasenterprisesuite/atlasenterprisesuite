import { useMemo, useState } from 'react';
import { healthModuleCatalog } from '../../../../../../packages/health/src';
import { HealthDataNotice } from '../shared/HealthDataNotice';
import { HealthModuleCard } from '../shared/HealthModuleCard';

export function ModuleDirectoryPage() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const modules = useMemo(() => healthModuleCatalog.filter((module) =>
    normalized.length === 0 ||
    module.name.toLowerCase().includes(normalized) ||
    module.description.toLowerCase().includes(normalized)
  ), [normalized]);

  return (
    <div className="page-stack">
      <HealthDataNotice state="demo" text="Module directory metadata is governed ATLAS configuration; operational records remain demo unless explicitly marked live." />
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Operations</p>
        <h1>Health Module Portfolio</h1>
        <p>Search and enter any of the 18 approved Health domains.</p>
      </header>

      <section className="workspace-card">
        <div className="toolbar">
          <label className="field wide-field">
            <span>Search modules</span>
            <input
              type="search"
              aria-label="Search modules"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or capability"
            />
          </label>
        </div>

        {modules.length === 0 ? (
          <p className="empty-state" role="status">No Health modules match this search.</p>
        ) : (
          <div className="module-grid health-module-grid" style={{ padding: 16 }}>
            {modules.map((module) => (
              <HealthModuleCard key={module.id} title={module.name} description={module.description} to={module.route} eyebrow="Health module" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
