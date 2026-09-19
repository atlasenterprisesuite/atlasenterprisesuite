import { useMemo, useState } from 'react';
import { AVIATION_CONCEPTS } from './aviation-concepts';
import { filterAviationConcepts } from './aviation-catalog';
import type { AviationCategory } from './aviation-model';

const CATEGORIES: readonly { value: AviationCategory; label: string }[] = [
  { value: 'urban', label: 'Urban Air Taxi' },
  { value: 'regional', label: 'Regional eVTOL' },
  { value: 'personal', label: 'Personal Flight' },
  { value: 'cargo', label: 'Cargo Lift' },
  { value: 'medical', label: 'Medical / Rescue' },
  { value: 'security', label: 'Security / Public Safety' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'group', label: 'Group Transport' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'hybrid', label: 'Hybrid / Extended Range' }
];

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value === null ? 'Not validated' : value}</dd>
    </div>
  );
}

export function AviationCatalogPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AviationCategory | 'all'>('all');

  const visibleConcepts = useMemo(
    () => filterAviationConcepts(AVIATION_CONCEPTS, { query, category }),
    [query, category]
  );

  return (
    <section className="page-stack aviation-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Mobility · Aviation Intelligence</p>
        <h1>Aircraft Catalog</h1>
        <p>Explore the approved ATLAS aircraft design family as governed concept records. Production specifications appear only after evidence and engineering validation exist.</p>
      </header>

      <div className="notice strong" role="note">
        Internal concept records · Range, speed, payload, price, valuation, certification and operational availability are not validated.
      </div>

      <section className="aviation-catalog-toolbar" aria-label="Aircraft catalog filters">
        <label className="field">
          <span>Search aircraft</span>
          <input
            aria-label="Search aircraft"
            type="search"
            value={query}
            placeholder="Model, mission or category"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Aircraft category</span>
          <select
            aria-label="Aircraft category"
            value={category}
            onChange={(event) => setCategory(event.target.value as AviationCategory | 'all')}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </section>

      <div className="aviation-catalog-summary" role="status" aria-live="polite">
        {visibleConcepts.length} of {AVIATION_CONCEPTS.length} internal concepts
      </div>

      {visibleConcepts.length === 0 ? (
        <div className="empty-state">
          <strong>No aircraft match these filters</strong>
          <span>Adjust the search or category. ATLAS will not manufacture records to fill an empty result.</span>
        </div>
      ) : (
        <div className="aviation-aircraft-grid">
          {visibleConcepts.map((aircraft) => (
            <article className="aviation-aircraft-card" data-testid="aviation-aircraft-card" key={aircraft.id}>
              <div className="aviation-aircraft-visual" aria-hidden="true">
                <span>{aircraft.modelName.replace('ATLAS ', '')}</span>
              </div>
              <div className="aviation-aircraft-copy">
                <div className="aviation-aircraft-heading">
                  <div>
                    <p className="eyebrow">{aircraft.categoryLabel}</p>
                    <h2>{aircraft.modelName}</h2>
                  </div>
                  <span className="status-pill">Internal concept</span>
                </div>
                <p>{aircraft.summary}</p>
                <p className="aviation-intended-use">{aircraft.intendedUse}</p>
                <dl className="aviation-metric-grid">
                  <Metric label="Speed" value={aircraft.metrics.speedKph} />
                  <Metric label="Range" value={aircraft.metrics.rangeKm} />
                  <Metric label="Payload" value={aircraft.metrics.payloadKg} />
                </dl>
                <div className="aviation-evidence-strip">
                  <span>Certification: Unverified</span>
                  <span>Investment: Not configured</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
