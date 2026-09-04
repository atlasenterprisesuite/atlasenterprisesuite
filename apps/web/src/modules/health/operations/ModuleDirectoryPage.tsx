import { useMemo, useState } from 'react';
import { healthModuleCatalog } from '../healthDomain';
import { HealthModuleCard } from '../shared/HealthModuleCard';

export function ModuleDirectoryPage() {
  const [query, setQuery] = useState('');
  const modules = useMemo(() => { const normalized = query.trim().toLowerCase(); return healthModuleCatalog.filter(module => normalized.length === 0 || module.name.toLowerCase().includes(normalized) || module.description.toLowerCase().includes(normalized)); }, [query]);
  return <section className="health-stack"><header className="page-header"><p className="eyebrow">Portfolio</p><h1>Health Module Directory</h1><p>Search and open every routed ATLAS Health workspace.</p></header><label className="field health-directory-search"><span>Search modules</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>{modules.length === 0 ? <div className="empty-state"><strong>No Health modules match this search.</strong><span>Change the search term to continue.</span></div> : <div className="health-module-grid">{modules.map(module => <HealthModuleCard key={module.id} title={module.name} description={module.description} to={module.route} />)}</div>}</section>;
}
